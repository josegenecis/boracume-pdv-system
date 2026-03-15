alter table if exists public.orders
  add column if not exists delivery_personnel_id uuid references public.delivery_personnel(id);

alter table if exists public.orders
  add column if not exists delivery_assigned_at timestamptz;

alter table if exists public.orders
  add column if not exists delivery_payout_amount numeric;

alter table if exists public.orders
  add column if not exists delivery_settled boolean not null default false;

alter table if exists public.orders
  add column if not exists delivery_settled_at timestamptz;

create table if not exists public.delivery_settlement_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  require_driver boolean not null default false,
  payout_mode text not null default 'delivery_fee',
  fixed_payout numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_settlement_settings enable row level security;

drop policy if exists "delivery_settlement_settings_owner_select" on public.delivery_settlement_settings;
create policy "delivery_settlement_settings_owner_select"
  on public.delivery_settlement_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "delivery_settlement_settings_owner_insert" on public.delivery_settlement_settings;
create policy "delivery_settlement_settings_owner_insert"
  on public.delivery_settlement_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "delivery_settlement_settings_owner_update" on public.delivery_settlement_settings;
create policy "delivery_settlement_settings_owner_update"
  on public.delivery_settlement_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

