alter table public.subscriptions
  add column if not exists installment_count integer not null default 1;

alter table public.subscriptions
  drop constraint if exists subscriptions_installment_count_check;

alter table public.subscriptions
  add constraint subscriptions_installment_count_check
  check (installment_count between 1 and 12);

alter table public.subscription_plan_changes
  add column if not exists to_installment_count integer not null default 1;

comment on column public.subscriptions.installment_count is
  'Quantidade de parcelas usadas no cartão para pagar o período contratado. A renovação permanece vinculada ao ciclo da assinatura.';
