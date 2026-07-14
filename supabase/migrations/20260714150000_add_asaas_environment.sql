alter table public.subscriptions
  add column if not exists asaas_environment text not null default 'sandbox';

alter table public.subscriptions
  drop constraint if exists subscriptions_asaas_environment_check;

alter table public.subscriptions
  add constraint subscriptions_asaas_environment_check
  check (asaas_environment in ('sandbox', 'production'));

comment on column public.subscriptions.asaas_environment is
  'Ambiente no qual os identificadores do cliente, assinatura e cobrança do Asaas foram criados.';
