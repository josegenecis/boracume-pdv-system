alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'MONTHLY',
  add column if not exists billing_months integer not null default 1,
  add column if not exists billing_discount_percent numeric(5,2) not null default 0,
  add column if not exists billing_amount numeric(10,2);

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_check;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'));

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_months_check;

alter table public.subscriptions
  add constraint subscriptions_billing_months_check
  check (billing_months in (1, 3, 6, 12));

update public.subscriptions
set billing_amount = coalesce(billing_amount, (
  select sp.price + greatest(0, coalesce(public.subscriptions.store_count, 1) - coalesce(sp.included_stores, 1)) * coalesce(sp.extra_store_price, 0)
  from public.subscription_plans sp
  where sp.id = public.subscriptions.plan_id
))
where billing_amount is null;

alter table public.subscription_plan_changes
  add column if not exists from_billing_cycle text not null default 'MONTHLY',
  add column if not exists to_billing_cycle text not null default 'MONTHLY',
  add column if not exists from_billing_months integer not null default 1,
  add column if not exists to_billing_months integer not null default 1,
  add column if not exists from_billing_amount numeric(10,2),
  add column if not exists to_billing_amount numeric(10,2),
  add column if not exists billing_discount_percent numeric(5,2) not null default 0;

comment on column public.subscriptions.billing_amount is 'Valor integral cobrado em cada ciclo recorrente, já com desconto do período.';
