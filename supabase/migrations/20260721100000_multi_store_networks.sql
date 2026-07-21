-- Multi-store foundation compatible with the legacy model where a restaurant is
-- identified by auth.users.id. Existing restaurants continue to operate as a
-- single store; network owners receive delegated access to linked store users.

create table if not exists public.store_networks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_network_stores (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.store_networks(id) on delete cascade,
  store_user_id uuid not null unique references auth.users(id) on delete cascade,
  store_name text not null,
  store_email text,
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, store_user_id)
);

create table if not exists public.store_network_invitations (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.store_networks(id) on delete cascade,
  email text not null,
  store_name text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_network_stores_network_idx
  on public.store_network_stores(network_id, status);
create index if not exists store_network_invitations_network_idx
  on public.store_network_invitations(network_id, status, created_at desc);
create index if not exists store_network_invitations_email_idx
  on public.store_network_invitations(lower(email), status);

alter table public.store_networks enable row level security;
alter table public.store_network_stores enable row level security;
alter table public.store_network_invitations enable row level security;

create or replace function public.can_access_store(p_store_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_store_user_id
    or exists (
      select 1
      from public.store_networks network
      join public.store_network_stores store on store.network_id = network.id
      where network.owner_user_id = auth.uid()
        and store.store_user_id = p_store_user_id
        and store.status = 'active'
    );
$$;

revoke all on function public.can_access_store(uuid) from public;
grant execute on function public.can_access_store(uuid) to authenticated, service_role;

drop policy if exists store_networks_select_accessible on public.store_networks;
create policy store_networks_select_accessible on public.store_networks
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.store_network_stores store
      where store.network_id = id and store.store_user_id = auth.uid() and store.status = 'active'
    )
  );

drop policy if exists store_networks_owner_manage on public.store_networks;
create policy store_networks_owner_manage on public.store_networks
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists store_network_stores_select_accessible on public.store_network_stores;
create policy store_network_stores_select_accessible on public.store_network_stores
  for select to authenticated
  using (
    store_user_id = auth.uid()
    or exists (
      select 1 from public.store_networks network
      where network.id = network_id and network.owner_user_id = auth.uid()
    )
  );

drop policy if exists store_network_stores_owner_manage on public.store_network_stores;
create policy store_network_stores_owner_manage on public.store_network_stores
  for all to authenticated
  using (
    exists (
      select 1 from public.store_networks network
      where network.id = network_id and network.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.store_networks network
      where network.id = network_id and network.owner_user_id = auth.uid()
    )
  );

drop policy if exists store_network_invitations_owner_select on public.store_network_invitations;
create policy store_network_invitations_owner_select on public.store_network_invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists store_network_invitations_owner_manage on public.store_network_invitations;
create policy store_network_invitations_owner_manage on public.store_network_invitations
  for all to authenticated
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

-- Create the network only for the owner of an active Multi subscription.
create or replace function public.ensure_my_store_network(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_network_id uuid;
  v_store_name text;
  v_email text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  if not exists (
    select 1 from public.subscriptions subscription
    where subscription.user_id = v_user_id
      and subscription.status = 'active'
      and coalesce(subscription.plan_id, 0) >= 3
  ) then
    raise exception 'multi_plan_required';
  end if;

  select id into v_network_id from public.store_networks where owner_user_id = v_user_id;
  if v_network_id is not null then return v_network_id; end if;

  select coalesce(nullif(profile.restaurant_name, ''), 'Minha rede'), profile.email
    into v_store_name, v_email
  from public.profiles profile where profile.id = v_user_id;

  insert into public.store_networks(owner_user_id, name)
  values (v_user_id, coalesce(nullif(trim(p_name), ''), v_store_name, 'Minha rede'))
  returning id into v_network_id;

  insert into public.store_network_stores(
    network_id, store_user_id, store_name, store_email, is_primary, status
  ) values (
    v_network_id, v_user_id, coalesce(v_store_name, 'Loja principal'),
    coalesce(v_email, (select email from auth.users where id = v_user_id)), true, 'active'
  ) on conflict (store_user_id) do nothing;

  return v_network_id;
end;
$$;

grant execute on function public.ensure_my_store_network(text) to authenticated;

create or replace function public.get_my_store_access()
returns table (
  network_id uuid,
  network_name text,
  store_user_id uuid,
  store_name text,
  store_email text,
  is_primary boolean,
  store_status text,
  billing_owner_id uuid,
  can_manage boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;

  if exists (select 1 from public.store_networks where owner_user_id = v_user_id) then
    return query
      select network.id, network.name, store.store_user_id, store.store_name,
        store.store_email, store.is_primary, store.status, network.owner_user_id, true
      from public.store_networks network
      join public.store_network_stores store on store.network_id = network.id
      where network.owner_user_id = v_user_id
      order by store.is_primary desc, store.store_name;
    return;
  end if;

  if exists (
    select 1 from public.store_network_stores store
    where store.store_user_id = v_user_id and store.status = 'active'
  ) then
    return query
      select network.id, network.name, store.store_user_id, store.store_name,
        store.store_email, store.is_primary, store.status, network.owner_user_id, false
      from public.store_network_stores store
      join public.store_networks network on network.id = store.network_id
      where store.store_user_id = v_user_id and store.status = 'active';
    return;
  end if;

  return query
    select null::uuid, coalesce(profile.restaurant_name, 'Meu restaurante'), v_user_id,
      coalesce(profile.restaurant_name, 'Meu restaurante'),
      coalesce(profile.email, (select email from auth.users where id = v_user_id)),
      true, 'active', v_user_id, false
    from public.profiles profile where profile.id = v_user_id;

  if not found then
    return query select null::uuid, 'Meu restaurante'::text, v_user_id,
      'Meu restaurante'::text, (select email from auth.users where id = v_user_id),
      true, 'active'::text, v_user_id, false;
  end if;
end;
$$;

grant execute on function public.get_my_store_access() to authenticated;

create or replace function public.get_my_billing_subscription()
returns setof public.subscriptions
language sql
stable
security definer
set search_path = public
as $$
  select subscription.*
  from public.subscriptions subscription
  where subscription.user_id = coalesce(
    (
      select network.owner_user_id
      from public.store_network_stores store
      join public.store_networks network on network.id = store.network_id
      where store.store_user_id = auth.uid() and store.status = 'active'
      limit 1
    ),
    auth.uid()
  )
  order by subscription.updated_at desc
  limit 1;
$$;

grant execute on function public.get_my_billing_subscription() to authenticated;

create or replace function public.get_my_network_summary(p_start_date timestamptz default date_trunc('month', now()))
returns table (
  store_user_id uuid,
  store_name text,
  order_count bigint,
  gross_sales numeric,
  average_ticket numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (select 1 from public.store_networks where owner_user_id = v_user_id) then
    raise exception 'network_owner_required';
  end if;

  return query
    select store.store_user_id, store.store_name,
      count(orders.id)::bigint,
      coalesce(sum(orders.total) filter (where orders.status <> 'cancelled'), 0)::numeric,
      coalesce(avg(orders.total) filter (where orders.status <> 'cancelled'), 0)::numeric
    from public.store_networks network
    join public.store_network_stores store on store.network_id = network.id and store.status = 'active'
    left join public.orders orders on orders.user_id = store.store_user_id and orders.created_at >= p_start_date
    where network.owner_user_id = v_user_id
    group by store.store_user_id, store.store_name
    order by store.store_name;
end;
$$;

grant execute on function public.get_my_network_summary(timestamptz) to authenticated;

create or replace function public.enforce_store_network_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_network_id uuid;
  v_capacity integer;
begin
  select id into v_network_id from public.store_networks where owner_user_id = new.user_id;
  if v_network_id is null then return new; end if;

  if new.status <> 'active' or coalesce(new.plan_id, 0) < 3 then
    update public.store_network_stores
      set status = 'suspended', updated_at = now()
      where network_id = v_network_id and not is_primary and status = 'active';
    return new;
  end if;

  v_capacity := greatest(1, coalesce(new.store_count, 1));
  update public.store_network_stores store
    set status = 'suspended', updated_at = now()
    where store.id in (
      select ranked.id
      from (
        select item.id, row_number() over (order by item.is_primary desc, item.created_at asc) as position
        from public.store_network_stores item
        where item.network_id = v_network_id and item.status = 'active'
      ) ranked
      where ranked.position > v_capacity
    );
  return new;
end;
$$;

drop trigger if exists enforce_store_network_capacity_trigger on public.subscriptions;
create trigger enforce_store_network_capacity_trigger
  after insert or update of status, plan_id, store_count on public.subscriptions
  for each row execute function public.enforce_store_network_capacity();

-- Extend existing RLS without replacing legacy policies. Only tables that
-- already have RLS enabled receive a delegated multi-store policy.
do $$
declare
  item record;
  policy_name text;
begin
  for item in
    select col.table_name, col.column_name
    from information_schema.columns col
    join pg_class relation on relation.relname = col.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace and namespace.nspname = 'public'
    where col.table_schema = 'public'
      and col.column_name in ('user_id', 'restaurant_id', 'restaurant_user_id')
      and col.udt_name = 'uuid'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
      and col.table_name not in ('store_networks', 'store_network_stores', 'store_network_invitations')
  loop
    policy_name := 'multi_store_access_' || item.column_name;
    execute format('drop policy if exists %I on public.%I', policy_name, item.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_access_store(%I)) with check (public.can_access_store(%I))',
      policy_name, item.table_name, item.column_name, item.column_name
    );
  end loop;
end $$;

drop policy if exists multi_store_access_id on public.profiles;
create policy multi_store_access_id on public.profiles
  for all to authenticated
  using (public.can_access_store(id))
  with check (public.can_access_store(id));

do $$
begin
  if to_regclass('public.product_global_variation_links') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.product_global_variation_links';
    execute 'create policy multi_store_parent_access on public.product_global_variation_links for all to authenticated using (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id))) with check (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id)))';
  end if;
  if to_regclass('public.product_variants') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.product_variants';
    execute 'create policy multi_store_parent_access on public.product_variants for all to authenticated using (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id))) with check (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id)))';
  end if;
  if to_regclass('public.product_recipes') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.product_recipes';
    execute 'create policy multi_store_parent_access on public.product_recipes for all to authenticated using (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id))) with check (exists (select 1 from public.products parent where parent.id = product_id and public.can_access_store(parent.user_id)))';
  end if;
  if to_regclass('public.nfce_items') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.nfce_items';
    execute 'create policy multi_store_parent_access on public.nfce_items for all to authenticated using (exists (select 1 from public.nfce_cupons parent where parent.id = cupom_id and public.can_access_store(parent.user_id))) with check (exists (select 1 from public.nfce_cupons parent where parent.id = cupom_id and public.can_access_store(parent.user_id)))';
  end if;
  if to_regclass('public.nfce_transmissions') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.nfce_transmissions';
    execute 'create policy multi_store_parent_access on public.nfce_transmissions for all to authenticated using (exists (select 1 from public.nfce_cupons parent where parent.id = cupom_id and public.can_access_store(parent.user_id))) with check (exists (select 1 from public.nfce_cupons parent where parent.id = cupom_id and public.can_access_store(parent.user_id)))';
  end if;
  if to_regclass('public.marketing_adsets') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.marketing_adsets';
    execute 'create policy multi_store_parent_access on public.marketing_adsets for all to authenticated using (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id))) with check (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id)))';
  end if;
  if to_regclass('public.marketing_creatives') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.marketing_creatives';
    execute 'create policy multi_store_parent_access on public.marketing_creatives for all to authenticated using (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id))) with check (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id)))';
  end if;
  if to_regclass('public.marketing_ads') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.marketing_ads';
    execute 'create policy multi_store_parent_access on public.marketing_ads for all to authenticated using (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id))) with check (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id)))';
  end if;
  if to_regclass('public.marketing_metrics') is not null then
    execute 'drop policy if exists multi_store_parent_access on public.marketing_metrics';
    execute 'create policy multi_store_parent_access on public.marketing_metrics for select to authenticated using (exists (select 1 from public.marketing_campaigns parent where parent.id = campaign_id and public.can_access_store(parent.restaurant_id)))';
  end if;
end $$;

comment on table public.store_networks is 'Billing and access group for a Multi plan customer.';
comment on table public.store_network_stores is 'Stores linked to a network; store_user_id preserves the legacy restaurant identity.';
