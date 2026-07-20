create extension if not exists pgcrypto;

alter table public.delivery_personnel
  add column if not exists app_enabled boolean not null default false,
  add column if not exists app_login text,
  add column if not exists app_password_hash text,
  add column if not exists last_seen_at timestamptz;

create unique index if not exists delivery_personnel_app_login_unique
  on public.delivery_personnel (lower(app_login))
  where app_login is not null;

alter table public.delivery_settlement_settings
  add column if not exists app_enabled boolean not null default false;

create table if not exists public.delivery_driver_sessions (
  id uuid primary key default gen_random_uuid(),
  delivery_personnel_id uuid not null references public.delivery_personnel(id) on delete cascade,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  target_driver_id uuid references public.delivery_personnel(id) on delete cascade,
  status text not null default 'open' check (status in ('open','accepted','declined','expired','cancelled')),
  payout_amount numeric not null default 0,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  accepted_by uuid references public.delivery_personnel(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_offers_one_open_per_order
  on public.delivery_offers(order_id) where status = 'open';
create index if not exists delivery_offers_restaurant_status_idx
  on public.delivery_offers(restaurant_id, status, created_at desc);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  delivery_personnel_id uuid not null references public.delivery_personnel(id) on delete restrict,
  offer_id uuid references public.delivery_offers(id) on delete set null,
  status text not null default 'accepted' check (status in ('accepted','arrived','picked_up','delivered','cancelled')),
  route_position integer not null default 1,
  payout_amount numeric not null default 0,
  accepted_at timestamptz not null default now(),
  arrived_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_assignments_driver_status_idx
  on public.delivery_assignments(delivery_personnel_id, status, route_position);

create table if not exists public.delivery_driver_locations (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  delivery_personnel_id uuid not null references public.delivery_personnel(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists delivery_driver_locations_assignment_time_idx
  on public.delivery_driver_locations(assignment_id, recorded_at desc);

create table if not exists public.delivery_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.delivery_assignments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  delivery_personnel_id uuid references public.delivery_personnel(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_driver_ledger (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  delivery_personnel_id uuid not null references public.delivery_personnel(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  entry_type text not null check (entry_type in ('delivery_credit','adjustment','settlement')),
  amount numeric not null,
  description text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists delivery_driver_ledger_order_credit_unique
  on public.delivery_driver_ledger(order_id, entry_type)
  where order_id is not null and entry_type = 'delivery_credit';

alter table public.delivery_driver_sessions enable row level security;
alter table public.delivery_offers enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_driver_locations enable row level security;
alter table public.delivery_events enable row level security;
alter table public.delivery_driver_ledger enable row level security;

drop policy if exists delivery_driver_sessions_owner_select on public.delivery_driver_sessions;
create policy delivery_driver_sessions_owner_select on public.delivery_driver_sessions
  for select to authenticated using (auth.uid() = restaurant_id);

drop policy if exists delivery_offers_owner_all on public.delivery_offers;
create policy delivery_offers_owner_all on public.delivery_offers
  for all to authenticated using (auth.uid() = restaurant_id) with check (auth.uid() = restaurant_id);

drop policy if exists delivery_assignments_owner_select on public.delivery_assignments;
create policy delivery_assignments_owner_select on public.delivery_assignments
  for select to authenticated using (auth.uid() = restaurant_id);

drop policy if exists delivery_driver_locations_owner_select on public.delivery_driver_locations;
create policy delivery_driver_locations_owner_select on public.delivery_driver_locations
  for select to authenticated using (
    exists (
      select 1 from public.delivery_assignments assignment
      where assignment.id = assignment_id and assignment.restaurant_id = auth.uid()
    )
  );

drop policy if exists delivery_events_owner_select on public.delivery_events;
create policy delivery_events_owner_select on public.delivery_events
  for select to authenticated using (auth.uid() = restaurant_id);

drop policy if exists delivery_driver_ledger_owner_all on public.delivery_driver_ledger;
create policy delivery_driver_ledger_owner_all on public.delivery_driver_ledger
  for all to authenticated using (auth.uid() = restaurant_id) with check (auth.uid() = restaurant_id);

create or replace function public.set_delivery_personnel_app_password(p_driver_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha deve ter pelo menos 6 caracteres';
  end if;
  update public.delivery_personnel
    set app_password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
    where id = p_driver_id and user_id = auth.uid();
  if not found then raise exception 'Motoboy não encontrado'; end if;
end;
$$;

revoke all on function public.set_delivery_personnel_app_password(uuid, text) from public;
grant execute on function public.set_delivery_personnel_app_password(uuid, text) to authenticated;

create or replace function public.verify_delivery_personnel_login(p_login text, p_password text)
returns table(id uuid, user_id uuid, name text, phone text, vehicle_type text, vehicle_plate text)
language sql
security definer
set search_path = public, extensions
as $$
  select d.id, d.user_id, d.name, d.phone, d.vehicle_type, d.vehicle_plate
  from public.delivery_personnel d
  where lower(d.app_login) = lower(trim(p_login))
    and d.app_enabled = true
    and d.app_password_hash = crypt(p_password, d.app_password_hash)
  limit 1;
$$;

revoke all on function public.verify_delivery_personnel_login(text, text) from public, anon, authenticated;
grant execute on function public.verify_delivery_personnel_login(text, text) to service_role;

create or replace function public.accept_delivery_offer(p_offer_id uuid, p_driver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_offer public.delivery_offers%rowtype;
  next_position integer;
  assignment_id uuid;
begin
  select * into selected_offer from public.delivery_offers
    where id = p_offer_id and status = 'open' and expires_at > now()
    for update;
  if not found then raise exception 'Esta entrega não está mais disponível'; end if;
  if selected_offer.target_driver_id is not null and selected_offer.target_driver_id <> p_driver_id then
    raise exception 'Oferta destinada a outro motoboy';
  end if;
  if not exists (
    select 1 from public.delivery_personnel d
    where d.id = p_driver_id and d.user_id = selected_offer.restaurant_id and d.app_enabled = true
  ) then raise exception 'Motoboy não autorizado para este restaurante'; end if;

  select coalesce(max(route_position), 0) + 1 into next_position
  from public.delivery_assignments
  where delivery_personnel_id = p_driver_id and status in ('accepted','arrived','picked_up');

  insert into public.delivery_assignments(
    restaurant_id, order_id, delivery_personnel_id, offer_id, route_position, payout_amount
  ) values (
    selected_offer.restaurant_id, selected_offer.order_id, p_driver_id, selected_offer.id,
    next_position, selected_offer.payout_amount
  ) returning id into assignment_id;

  update public.delivery_offers set status = 'accepted', accepted_by = p_driver_id,
    accepted_at = now(), updated_at = now() where id = p_offer_id;
  update public.orders set delivery_personnel_id = p_driver_id,
    delivery_assigned_at = now(), delivery_payout_amount = selected_offer.payout_amount
    where id = selected_offer.order_id;
  update public.delivery_personnel set status = 'busy', updated_at = now() where id = p_driver_id;
  insert into public.delivery_events(restaurant_id, assignment_id, order_id, delivery_personnel_id, event_type)
    values(selected_offer.restaurant_id, assignment_id, selected_offer.order_id, p_driver_id, 'accepted');
  return assignment_id;
end;
$$;

revoke all on function public.accept_delivery_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_delivery_offer(uuid, uuid) to service_role;

do $$ begin
  alter publication supabase_realtime add table public.delivery_offers;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.delivery_assignments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.delivery_driver_locations;
exception when duplicate_object then null; end $$;
