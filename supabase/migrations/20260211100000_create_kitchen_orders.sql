create table if not exists public.kitchen_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_number text not null,
  customer_name text not null,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  priority text not null default 'normal',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kitchen_orders enable row level security;

drop policy if exists kitchen_orders_owner_select on public.kitchen_orders;
create policy kitchen_orders_owner_select
  on public.kitchen_orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists kitchen_orders_owner_insert on public.kitchen_orders;
create policy kitchen_orders_owner_insert
  on public.kitchen_orders for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists kitchen_orders_owner_update on public.kitchen_orders;
create policy kitchen_orders_owner_update
  on public.kitchen_orders for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists kitchen_orders_owner_delete on public.kitchen_orders;
create policy kitchen_orders_owner_delete
  on public.kitchen_orders for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists kitchen_orders_anon_insert on public.kitchen_orders;
create policy kitchen_orders_anon_insert
  on public.kitchen_orders for insert
  to anon
  with check (user_id is not null);

