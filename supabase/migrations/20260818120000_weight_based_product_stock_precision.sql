-- Estoque de produto pronto precisa preservar a quantidade fracionada vendida
-- (ex.: 0,282 kg). O modelo anterior usava integer e arredondava a venda.

alter table public.products
  alter column stock_quantity type numeric(18, 6) using stock_quantity::numeric(18, 6),
  alter column stock_quantity set default 0,
  alter column low_stock_threshold type numeric(18, 6) using low_stock_threshold::numeric(18, 6),
  alter column low_stock_threshold set default 0;

alter table public.inventory_movements
  alter column quantity type numeric(18, 6) using quantity::numeric(18, 6);

alter table public.smart_invoice_import_items
  alter column product_quantity_added type numeric(18, 6) using product_quantity_added::numeric(18, 6),
  alter column product_quantity_added set default 0;

create or replace function public.sync_order_stock_accounting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_statuses text[] := array['accepted', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'];
  movement record;
  ingredient_movement record;
  inserted_id uuid;
  sold_qty numeric(18, 6);
  returned_qty numeric(18, 6);
  pending_qty numeric(18, 6);
  next_ingredient_stock numeric(18, 6);
begin
  if tg_op = 'DELETE' then return old; end if;
  if new.items is null or jsonb_typeof(new.items) <> 'array' then return new; end if;

  if coalesce(new.status, '') = any(active_statuses)
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> all(active_statuses)) then
    -- Produto pronto sem ficha tecnica: baixa a quantidade exata, inclusive kg.
    for movement in
      select parsed.product_id,
             round(sum(parsed.quantity), 6)::numeric(18, 6) as quantity
      from (
        select nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
               greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::numeric(18, 6) as quantity
        from jsonb_array_elements(new.items) item
        where coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) parsed
      join public.products product
        on product.id = parsed.product_id
       and product.user_id = new.user_id
       and product.track_stock = true
       and public.should_deduct_finished_product_stock(product.id)
      where parsed.quantity > 0
      group by parsed.product_id
    loop
      inserted_id := null;
      insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
      values (new.user_id, movement.product_id, new.id, 'sale', -movement.quantity)
      on conflict do nothing returning id into inserted_id;

      if inserted_id is not null then
        update public.products
        set stock_quantity = greatest(round(coalesce(stock_quantity, 0) - movement.quantity, 6), 0),
            available = case when greatest(round(coalesce(stock_quantity, 0) - movement.quantity, 6), 0) <= 0 then false else available end,
            is_available = case when greatest(round(coalesce(stock_quantity, 0) - movement.quantity, 6), 0) <= 0 then false else is_available end,
            show_in_delivery = case when greatest(round(coalesce(stock_quantity, 0) - movement.quantity, 6), 0) <= 0 then false else show_in_delivery end
        where id = movement.product_id and user_id = new.user_id and track_stock = true;
      end if;
    end loop;

    -- Produto com ficha tecnica: baixa os insumos fracionados configurados.
    for ingredient_movement in
      select recipe.ingredient_id,
             sum(recipe.quantity * (1 + coalesce(recipe.waste_percentage, 0) / 100) * parsed.quantity)::numeric(18, 6) as quantity,
             max(ingredient.cost_price)::numeric(18, 6) as unit_cost
      from (
        select nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
               greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::numeric as quantity
        from jsonb_array_elements(new.items) item
        where coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) parsed
      join public.products product on product.id = parsed.product_id and product.user_id = new.user_id
      join public.product_recipes recipe on recipe.product_id = parsed.product_id
      join public.ingredients ingredient
        on ingredient.id = recipe.ingredient_id
       and ingredient.user_id = new.user_id
       and ingredient.stock_control_mode = 'automatic_recipe'
      where parsed.quantity > 0
      group by recipe.ingredient_id
    loop
      if not exists (
        select 1 from public.stock_movements sm
        where sm.user_id = new.user_id and sm.order_id = new.id
          and sm.ingredient_id = ingredient_movement.ingredient_id and sm.movement_type = 'sale'
      ) then
        update public.ingredients
        set current_stock = coalesce(current_stock, 0) - ingredient_movement.quantity,
            updated_at = now()
        where id = ingredient_movement.ingredient_id and user_id = new.user_id
        returning current_stock into next_ingredient_stock;

        insert into public.stock_movements (
          user_id, ingredient_id, movement_type, quantity, unit_cost, total_cost,
          balance_after, average_cost_after, reason, order_id
        ) values (
          new.user_id, ingredient_movement.ingredient_id, 'sale', ingredient_movement.quantity,
          ingredient_movement.unit_cost, round(ingredient_movement.quantity * ingredient_movement.unit_cost, 6),
          next_ingredient_stock, ingredient_movement.unit_cost,
          'Baixa automatica por venda do pedido ' || coalesce(new.order_number, new.id::text), new.id
        );
      end if;
    end loop;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.status, '') = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    for movement in
      select product_id, round(abs(sum(quantity)), 6)::numeric(18, 6) as quantity
      from public.inventory_movements
      where user_id = new.user_id and order_id = new.id and type = 'sale'
      group by product_id
    loop
      select coalesce(sum(quantity), 0) into returned_qty
      from public.inventory_movements
      where user_id = new.user_id and order_id = new.id and product_id = movement.product_id and type = 'return';
      pending_qty := greatest(movement.quantity - coalesce(returned_qty, 0), 0);
      if pending_qty <= 0 then continue; end if;

      update public.products
      set stock_quantity = round(coalesce(stock_quantity, 0) + pending_qty, 6),
          available = true, is_available = true, show_in_delivery = true
      where id = movement.product_id and user_id = new.user_id and track_stock = true;

      insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
      values (new.user_id, movement.product_id, new.id, 'return', pending_qty);
    end loop;

    for ingredient_movement in
      select ingredient_id, sum(quantity)::numeric(18, 6) as quantity,
             max(coalesce(unit_cost, 0))::numeric(18, 6) as unit_cost
      from public.stock_movements
      where user_id = new.user_id and order_id = new.id and movement_type = 'sale'
      group by ingredient_id
    loop
      select coalesce(sum(quantity), 0) into returned_qty
      from public.stock_movements
      where user_id = new.user_id and order_id = new.id
        and ingredient_id = ingredient_movement.ingredient_id and movement_type = 'return';
      sold_qty := coalesce(ingredient_movement.quantity, 0);
      pending_qty := greatest(sold_qty - coalesce(returned_qty, 0), 0);
      if pending_qty <= 0 then continue; end if;

      update public.ingredients
      set current_stock = coalesce(current_stock, 0) + pending_qty, updated_at = now()
      where id = ingredient_movement.ingredient_id and user_id = new.user_id
      returning current_stock into next_ingredient_stock;

      insert into public.stock_movements (
        user_id, ingredient_id, movement_type, quantity, unit_cost, total_cost,
        balance_after, average_cost_after, reason, order_id
      ) values (
        new.user_id, ingredient_movement.ingredient_id, 'return', pending_qty,
        ingredient_movement.unit_cost, round(pending_qty * ingredient_movement.unit_cost, 6),
        next_ingredient_stock, ingredient_movement.unit_cost,
        'Estorno automatico por cancelamento do pedido ' || coalesce(new.order_number, new.id::text), new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
