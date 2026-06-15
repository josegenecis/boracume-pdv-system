-- Centraliza a baixa e o estorno de estoque de pedidos.
-- Produto pronto e ficha tecnica passam pela mesma regra, independente da origem:
-- PDV, mesas, cardapio, totem, iFood ou app garcom.

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unit text not null default 'un',
  current_stock numeric(10, 3) not null default 0,
  min_stock numeric(10, 3) not null default 0,
  cost_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists name text,
  add column if not exists unit text default 'un',
  add column if not exists current_stock numeric(10, 3) not null default 0,
  add column if not exists min_stock numeric(10, 3) not null default 0,
  add column if not exists cost_price numeric(10, 2) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(10, 3) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  movement_type text not null,
  quantity numeric(10, 3) not null,
  unit_cost numeric(10, 2),
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.stock_movements
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists ingredient_id uuid references public.ingredients(id) on delete cascade,
  add column if not exists movement_type text,
  add column if not exists quantity numeric(10, 3),
  add column if not exists unit_cost numeric(10, 2),
  add column if not exists reason text,
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.ingredients enable row level security;
alter table public.product_recipes enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists ingredients_owner_all on public.ingredients;
create policy ingredients_owner_all
  on public.ingredients for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists product_recipes_owner_all on public.product_recipes;
create policy product_recipes_owner_all
  on public.product_recipes for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_recipes.product_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_recipes.product_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists stock_movements_owner_all on public.stock_movements;
create policy stock_movements_owner_all
  on public.stock_movements for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_product_recipes_product_id
  on public.product_recipes(product_id);

create index if not exists idx_product_recipes_ingredient_id
  on public.product_recipes(ingredient_id);

create index if not exists idx_stock_movements_user_order
  on public.stock_movements(user_id, order_id);

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in ('in', 'out', 'loss', 'sale', 'return'));

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
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  -- Baixa uma unica vez quando o pedido entra no fluxo ativo.
  if coalesce(new.status, '') = any(active_statuses)
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> all(active_statuses)) then

    -- Estoque do produto vendido.
    for movement in
      select
        parsed.product_id,
        sum(parsed.quantity)::integer as quantity
      from (
        select
          nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
          greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::integer as quantity
        from jsonb_array_elements(new.items) as item
        where coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) parsed
      join public.products product
        on product.id = parsed.product_id
       and product.user_id = new.user_id
       and product.track_stock = true
      where parsed.quantity > 0
      group by parsed.product_id
    loop
      inserted_id := null;

      insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
      values (new.user_id, movement.product_id, new.id, 'sale', -movement.quantity)
      on conflict do nothing
      returning id into inserted_id;

      if inserted_id is not null then
        update public.products
        set
          stock_quantity = greatest(coalesce(stock_quantity, 0) - movement.quantity, 0),
          available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else available end,
          is_available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else is_available end,
          show_in_delivery = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else show_in_delivery end
        where id = movement.product_id
          and user_id = new.user_id
          and track_stock = true;
      end if;
    end loop;

    -- Estoque dos insumos da ficha tecnica.
    for ingredient_movement in
      select
        recipe.ingredient_id,
        sum(recipe.quantity * parsed.quantity)::numeric(10, 3) as quantity
      from (
        select
          nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
          greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::numeric as quantity
        from jsonb_array_elements(new.items) as item
        where coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) parsed
      join public.products product
        on product.id = parsed.product_id
       and product.user_id = new.user_id
      join public.product_recipes recipe
        on recipe.product_id = parsed.product_id
      join public.ingredients ingredient
        on ingredient.id = recipe.ingredient_id
       and ingredient.user_id = new.user_id
      where parsed.quantity > 0
      group by recipe.ingredient_id
    loop
      if not exists (
        select 1
        from public.stock_movements sm
        where sm.user_id = new.user_id
          and sm.order_id = new.id
          and sm.ingredient_id = ingredient_movement.ingredient_id
          and sm.movement_type = 'sale'
      ) then
        insert into public.stock_movements (
          user_id, ingredient_id, movement_type, quantity, reason, order_id
        ) values (
          new.user_id,
          ingredient_movement.ingredient_id,
          'sale',
          ingredient_movement.quantity,
          'Baixa automatica por venda do pedido ' || coalesce(new.order_number, new.id::text),
          new.id
        );

        update public.ingredients
        set
          current_stock = coalesce(current_stock, 0) - ingredient_movement.quantity,
          updated_at = now()
        where id = ingredient_movement.ingredient_id
          and user_id = new.user_id;
      end if;
    end loop;
  end if;

  -- Estorna uma unica vez quando o pedido e cancelado.
  if tg_op = 'UPDATE'
     and coalesce(new.status, '') = 'cancelled'
     and coalesce(old.status, '') <> 'cancelled' then

    for movement in
      select product_id, abs(sum(quantity))::integer as quantity
      from public.inventory_movements
      where user_id = new.user_id
        and order_id = new.id
        and type = 'sale'
      group by product_id
    loop
      select coalesce(sum(quantity), 0)
      into returned_qty
      from public.inventory_movements
      where user_id = new.user_id
        and order_id = new.id
        and product_id = movement.product_id
        and type = 'return';

      pending_qty := greatest(movement.quantity - coalesce(returned_qty, 0), 0);
      if pending_qty <= 0 then
        continue;
      end if;

      update public.products
      set
        stock_quantity = coalesce(stock_quantity, 0) + pending_qty::integer,
        available = true,
        is_available = true,
        show_in_delivery = true
      where id = movement.product_id
        and user_id = new.user_id
        and track_stock = true;

      insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
      values (new.user_id, movement.product_id, new.id, 'return', pending_qty::integer);
    end loop;

    for ingredient_movement in
      select ingredient_id, sum(quantity)::numeric(10, 3) as quantity
      from public.stock_movements
      where user_id = new.user_id
        and order_id = new.id
        and movement_type = 'sale'
      group by ingredient_id
    loop
      select coalesce(sum(quantity), 0)
      into returned_qty
      from public.stock_movements
      where user_id = new.user_id
        and order_id = new.id
        and ingredient_id = ingredient_movement.ingredient_id
        and movement_type = 'return';

      sold_qty := coalesce(ingredient_movement.quantity, 0);
      pending_qty := greatest(sold_qty - coalesce(returned_qty, 0), 0);
      if pending_qty <= 0 then
        continue;
      end if;

      update public.ingredients
      set
        current_stock = coalesce(current_stock, 0) + pending_qty,
        updated_at = now()
      where id = ingredient_movement.ingredient_id
        and user_id = new.user_id;

      insert into public.stock_movements (
        user_id, ingredient_id, movement_type, quantity, reason, order_id
      ) values (
        new.user_id,
        ingredient_movement.ingredient_id,
        'return',
        pending_qty,
        'Estorno automatico por cancelamento do pedido ' || coalesce(new.order_number, new.id::text),
        new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists order_inventory_trigger on public.orders;
drop trigger if exists trigger_apply_stock_on_order_preparing on public.orders;
drop trigger if exists trigger_apply_product_stock_on_order_sale on public.orders;
drop trigger if exists trigger_sync_order_stock_accounting on public.orders;

create trigger trigger_sync_order_stock_accounting
  after insert or update of status on public.orders
  for each row
  execute function public.sync_order_stock_accounting();

drop function if exists public.process_order_inventory_deduction();
drop function if exists public.apply_stock_on_order_preparing();
drop function if exists public.apply_product_stock_on_order_sale();
