-- CMV profissional: custo medio ponderado, conversao de compra/consumo
-- e fotografia do custo no momento da venda.

alter table public.ingredients
  alter column cost_price type numeric(18, 6) using coalesce(cost_price, 0)::numeric(18, 6),
  add column if not exists purchase_unit text,
  add column if not exists purchase_conversion numeric(18, 6) not null default 1,
  add column if not exists yield_percentage numeric(7, 4) not null default 100,
  add column if not exists last_purchase_cost numeric(18, 6),
  add column if not exists cost_method text not null default 'weighted_average';

update public.ingredients
set purchase_unit = coalesce(nullif(purchase_unit, ''), unit)
where purchase_unit is null or purchase_unit = '';

alter table public.ingredients
  alter column purchase_unit set default 'un',
  alter column purchase_unit set not null;

alter table public.ingredients
  drop constraint if exists ingredients_purchase_conversion_check,
  add constraint ingredients_purchase_conversion_check check (purchase_conversion > 0),
  drop constraint if exists ingredients_yield_percentage_check,
  add constraint ingredients_yield_percentage_check check (yield_percentage > 0 and yield_percentage <= 100),
  drop constraint if exists ingredients_cost_method_check,
  add constraint ingredients_cost_method_check check (cost_method in ('weighted_average'));

alter table public.stock_movements
  alter column unit_cost type numeric(18, 6) using unit_cost::numeric(18, 6),
  add column if not exists total_cost numeric(18, 6),
  add column if not exists balance_after numeric(18, 6),
  add column if not exists average_cost_after numeric(18, 6);

alter table public.product_recipes
  add column if not exists waste_percentage numeric(7, 4) not null default 0;

delete from public.product_recipes where coalesce(quantity, 0) <= 0;

with grouped as (
  select
    product_id,
    ingredient_id,
    (array_agg(id order by created_at, id))[1] as keep_id,
    sum(quantity)::numeric(10, 3) as total_quantity,
    max(coalesce(waste_percentage, 0))::numeric(7, 4) as waste_percentage
  from public.product_recipes
  group by product_id, ingredient_id
  having count(*) > 1
)
update public.product_recipes recipe
set quantity = grouped.total_quantity,
    waste_percentage = grouped.waste_percentage
from grouped
where recipe.id = grouped.keep_id;

with ranked as (
  select id, row_number() over (partition by product_id, ingredient_id order by created_at, id) as position
  from public.product_recipes
)
delete from public.product_recipes recipe
using ranked
where recipe.id = ranked.id and ranked.position > 1;

alter table public.product_recipes
  drop constraint if exists product_recipes_quantity_positive,
  add constraint product_recipes_quantity_positive check (quantity > 0),
  drop constraint if exists product_recipes_waste_percentage_check,
  add constraint product_recipes_waste_percentage_check check (waste_percentage >= 0 and waste_percentage <= 100);

create unique index if not exists product_recipes_product_ingredient_unique
  on public.product_recipes(product_id, ingredient_id);

alter table public.orders
  add column if not exists cmv_total numeric(18, 6),
  add column if not exists cmv_snapshot jsonb,
  add column if not exists cmv_calculated_at timestamptz;

create or replace function public.record_ingredient_purchase(
  p_ingredient_id uuid,
  p_purchase_quantity numeric,
  p_purchase_unit_cost numeric,
  p_reason text default 'Entrada manual pelo estoque',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ingredient_row public.ingredients%rowtype;
  stock_added numeric(18, 6);
  purchase_total numeric(18, 6);
  converted_unit_cost numeric(18, 6);
  previous_stock numeric(18, 6);
  previous_value numeric(18, 6);
  next_stock numeric(18, 6);
  next_average_cost numeric(18, 6);
  effective_owner uuid;
begin
  effective_owner := auth.uid();
  if effective_owner is null and auth.role() = 'service_role' then
    effective_owner := p_owner_id;
  end if;
  if effective_owner is null then
    raise exception 'Sessao expirada. Entre novamente.';
  end if;
  if auth.uid() is not null and p_owner_id is not null and p_owner_id <> auth.uid() then
    raise exception 'Restaurante invalido para esta sessao.';
  end if;
  if coalesce(p_purchase_quantity, 0) <= 0 then
    raise exception 'A quantidade comprada deve ser maior que zero.';
  end if;
  if coalesce(p_purchase_unit_cost, 0) < 0 then
    raise exception 'O custo da compra nao pode ser negativo.';
  end if;

  select * into ingredient_row
  from public.ingredients
  where id = p_ingredient_id and user_id = effective_owner
  for update;

  if not found then
    raise exception 'Insumo nao encontrado para este restaurante.';
  end if;

  stock_added := round(
    p_purchase_quantity
    * coalesce(ingredient_row.purchase_conversion, 1)
    * (coalesce(ingredient_row.yield_percentage, 100) / 100),
    6
  );
  if stock_added <= 0 then
    raise exception 'A conversao da compra resultou em estoque zero.';
  end if;

  purchase_total := round(p_purchase_quantity * p_purchase_unit_cost, 6);
  converted_unit_cost := round(purchase_total / stock_added, 6);
  previous_stock := greatest(coalesce(ingredient_row.current_stock, 0), 0);
  previous_value := round(previous_stock * coalesce(ingredient_row.cost_price, 0), 6);
  next_stock := round(coalesce(ingredient_row.current_stock, 0) + stock_added, 6);
  next_average_cost := case
    when previous_stock + stock_added > 0
      then round((previous_value + purchase_total) / (previous_stock + stock_added), 6)
    else converted_unit_cost
  end;

  update public.ingredients
  set current_stock = next_stock,
      cost_price = next_average_cost,
      last_purchase_cost = p_purchase_unit_cost,
      updated_at = now()
  where id = ingredient_row.id;

  insert into public.stock_movements (
    user_id, ingredient_id, movement_type, quantity, unit_cost,
    total_cost, balance_after, average_cost_after, reason
  ) values (
    effective_owner, ingredient_row.id, 'in', stock_added, converted_unit_cost,
    purchase_total, next_stock, next_average_cost, coalesce(nullif(trim(p_reason), ''), 'Entrada de estoque')
  );

  return jsonb_build_object(
    'ingredient_id', ingredient_row.id,
    'stock_added', stock_added,
    'current_stock', next_stock,
    'average_cost', next_average_cost,
    'purchase_total', purchase_total
  );
end;
$$;

revoke all on function public.record_ingredient_purchase(uuid, numeric, numeric, text, uuid) from public;
grant execute on function public.record_ingredient_purchase(uuid, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.record_ingredient_purchase(uuid, numeric, numeric, text, uuid) to service_role;

create or replace function public.capture_order_cmv_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_statuses text[] := array['accepted', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'];
  snapshot_items jsonb := '[]'::jsonb;
  snapshot_total numeric(18, 6) := 0;
  gross_items_total numeric(18, 6) := 0;
  net_products_total numeric(18, 6) := 0;
begin
  if coalesce(new.status, '') <> all(active_statuses)
     or new.items is null
     or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.cmv_calculated_at is not null
     and new.items is not distinct from old.items then
    return new;
  end if;

  select coalesce(sum(
    coalesce(
      nullif(item->>'subtotal', '')::numeric,
      nullif(item->>'total_price', '')::numeric,
      coalesce(nullif(item->>'price', '')::numeric, 0) * greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0)
    )
  ), 0)
  into gross_items_total
  from jsonb_array_elements(new.items) item;

  net_products_total := greatest(coalesce(new.total, 0) - coalesce(new.delivery_fee, 0), 0);

  with parsed_items as (
    select
      item_order::integer as item_order,
      case
        when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'product_id', item->>'id')::uuid
        else null
      end as product_id,
      coalesce(nullif(item->>'product_name', ''), nullif(item->>'name', ''), 'Produto') as product_name,
      greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0) as quantity,
      coalesce(
        nullif(item->>'subtotal', '')::numeric,
        nullif(item->>'total_price', '')::numeric,
        coalesce(nullif(item->>'price', '')::numeric, 0) * greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0)
      ) as gross_revenue
    from jsonb_array_elements(new.items) with ordinality source(item, item_order)
  ), recipe_costs as (
    select
      recipe.product_id,
      sum(
        recipe.quantity
        * (1 + coalesce(recipe.waste_percentage, 0) / 100)
        * coalesce(ingredient.cost_price, 0)
      )::numeric(18, 6) as unit_cost,
      count(*) as recipe_items
    from public.product_recipes recipe
    join public.ingredients ingredient
      on ingredient.id = recipe.ingredient_id
     and ingredient.user_id = new.user_id
    group by recipe.product_id
  ), calculated as (
    select
      parsed.item_order,
      parsed.product_id,
      parsed.product_name,
      parsed.quantity,
      round(parsed.gross_revenue, 6) as gross_revenue,
      round(
        case when gross_items_total > 0
          then parsed.gross_revenue * net_products_total / gross_items_total
          else parsed.gross_revenue
        end,
        6
      ) as net_revenue,
      round(coalesce(recipe.unit_cost, 0), 6) as unit_cost,
      round(coalesce(recipe.unit_cost, 0) * parsed.quantity, 6) as total_cost,
      coalesce(recipe.recipe_items, 0) > 0 as has_recipe
    from parsed_items parsed
    left join recipe_costs recipe on recipe.product_id = parsed.product_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'item_order', item_order,
      'product_id', product_id,
      'product_name', product_name,
      'quantity', quantity,
      'gross_revenue', gross_revenue,
      'net_revenue', net_revenue,
      'unit_cost', unit_cost,
      'total_cost', total_cost,
      'has_recipe', has_recipe
    ) order by item_order), '[]'::jsonb),
    coalesce(sum(total_cost), 0)::numeric(18, 6)
  into snapshot_items, snapshot_total
  from calculated;

  update public.orders
  set cmv_total = snapshot_total,
      cmv_snapshot = jsonb_build_object(
        'version', 1,
        'captured_at', now(),
        'items', snapshot_items
      ),
      cmv_calculated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists trigger_capture_order_cmv_snapshot on public.orders;
create trigger trigger_capture_order_cmv_snapshot
  after insert or update of status, items on public.orders
  for each row execute function public.capture_order_cmv_snapshot();

-- Produtos preparados por ficha tecnica consomem insumos. Produtos prontos sem
-- ficha continuam usando o estoque unitario do cadastro do produto.
create or replace function public.should_deduct_finished_product_stock(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.product_recipes recipe where recipe.product_id = p_product_id
  );
$$;

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
  sold_qty numeric;
  returned_qty numeric;
  pending_qty numeric;
  next_ingredient_stock numeric;
begin
  if tg_op = 'DELETE' then return old; end if;
  if new.items is null or jsonb_typeof(new.items) <> 'array' then return new; end if;

  if coalesce(new.status, '') = any(active_statuses)
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> all(active_statuses)) then
    for movement in
      select parsed.product_id, sum(parsed.quantity)::integer as quantity
      from (
        select nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
               greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::integer as quantity
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
        set stock_quantity = greatest(coalesce(stock_quantity, 0) - movement.quantity, 0),
            available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else available end,
            is_available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else is_available end,
            show_in_delivery = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else show_in_delivery end
        where id = movement.product_id and user_id = new.user_id and track_stock = true;
      end if;
    end loop;

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
      join public.ingredients ingredient on ingredient.id = recipe.ingredient_id and ingredient.user_id = new.user_id
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
      select product_id, abs(sum(quantity))::integer as quantity
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
      set stock_quantity = coalesce(stock_quantity, 0) + pending_qty::integer,
          available = true, is_available = true, show_in_delivery = true
      where id = movement.product_id and user_id = new.user_id and track_stock = true;
      insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
      values (new.user_id, movement.product_id, new.id, 'return', pending_qty::integer);
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
