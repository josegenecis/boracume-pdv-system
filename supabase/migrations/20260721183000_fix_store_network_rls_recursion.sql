-- Avoid recursive RLS evaluation between store_networks and
-- store_network_stores. These helpers execute as the function owner and expose
-- only boolean membership checks.

create or replace function public.is_store_network_owner(p_network_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_networks network
    where network.id = p_network_id
      and network.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_store_network_member(p_network_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_network_stores store
    where store.network_id = p_network_id
      and store.store_user_id = auth.uid()
      and store.status = 'active'
  );
$$;

revoke all on function public.is_store_network_owner(uuid) from public;
revoke all on function public.is_store_network_member(uuid) from public;
grant execute on function public.is_store_network_owner(uuid) to authenticated, service_role;
grant execute on function public.is_store_network_member(uuid) to authenticated, service_role;

drop policy if exists store_networks_select_accessible on public.store_networks;
create policy store_networks_select_accessible on public.store_networks
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or public.is_store_network_member(id)
  );

drop policy if exists store_network_stores_select_accessible on public.store_network_stores;
create policy store_network_stores_select_accessible on public.store_network_stores
  for select to authenticated
  using (
    store_user_id = auth.uid()
    or public.is_store_network_owner(network_id)
  );

drop policy if exists store_network_stores_owner_manage on public.store_network_stores;
create policy store_network_stores_owner_manage on public.store_network_stores
  for all to authenticated
  using (public.is_store_network_owner(network_id))
  with check (public.is_store_network_owner(network_id));

