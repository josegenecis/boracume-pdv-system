alter table public.orders enable row level security;

drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists orders_owner_insert on public.orders;
create policy orders_owner_insert
  on public.orders for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update
  on public.orders for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists orders_owner_delete on public.orders;
create policy orders_owner_delete
  on public.orders for delete
  to authenticated
  using (user_id = auth.uid());

