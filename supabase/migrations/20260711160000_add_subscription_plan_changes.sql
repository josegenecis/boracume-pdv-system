create table if not exists public.subscription_plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_plan_id integer references public.subscription_plans(id),
  to_plan_id integer not null references public.subscription_plans(id),
  from_store_count integer not null default 1,
  to_store_count integer not null default 1,
  old_monthly_value numeric(10,2) not null default 0,
  new_monthly_value numeric(10,2) not null default 0,
  credit_amount numeric(10,2) not null default 0,
  charge_amount numeric(10,2) not null default 0,
  remaining_days numeric(10,4) not null default 0,
  period_days numeric(10,4) not null default 30,
  payment_method text not null check (payment_method in ('PIX', 'CREDIT_CARD')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'failed')),
  old_asaas_subscription_id text,
  new_asaas_customer_id text,
  new_asaas_subscription_id text,
  asaas_payment_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_subscription_plan_changes_user
  on public.subscription_plan_changes (user_id, created_at desc);

create unique index if not exists idx_subscription_plan_changes_payment
  on public.subscription_plan_changes (asaas_payment_id)
  where asaas_payment_id is not null;

alter table public.subscription_plan_changes enable row level security;

drop policy if exists "Users can view their own subscription plan changes"
  on public.subscription_plan_changes;

create policy "Users can view their own subscription plan changes"
  on public.subscription_plan_changes
  for select
  using (auth.uid() = user_id);
