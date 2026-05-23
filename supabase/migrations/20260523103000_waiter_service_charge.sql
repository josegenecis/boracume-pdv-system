create table if not exists public.waiter_service_charge_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  percentage numeric(6, 2) not null default 10,
  tax_withhold_percent numeric(6, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.waiter_service_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  account_id uuid references public.table_accounts(id) on delete set null,
  waiter_id uuid references public.waiters(id) on delete set null,
  base_amount numeric(12, 2) not null default 0,
  percentage numeric(6, 2) not null default 10,
  gross_amount numeric(12, 2) not null default 0,
  tax_withhold_percent numeric(6, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  net_waiter_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.waiter_service_charge_settings enable row level security;
alter table public.waiter_service_charges enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'waiter_service_charge_settings'
      and policyname = 'service_charge_settings_owner_all'
  ) then
    create policy service_charge_settings_owner_all
      on public.waiter_service_charge_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'waiter_service_charges'
      and policyname = 'service_charges_owner_all'
  ) then
    create policy service_charges_owner_all
      on public.waiter_service_charges
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_waiter_service_charges_user_id on public.waiter_service_charges(user_id);
create index if not exists idx_waiter_service_charges_session_id on public.waiter_service_charges(session_id);
create index if not exists idx_waiter_service_charges_waiter_id on public.waiter_service_charges(waiter_id);
