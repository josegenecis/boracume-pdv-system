alter table public.subscriptions
  add column if not exists payment_method text;

alter table public.subscriptions
  drop constraint if exists subscriptions_payment_method_check;

alter table public.subscriptions
  add constraint subscriptions_payment_method_check
  check (payment_method is null or payment_method in ('PIX', 'CREDIT_CARD'));

comment on column public.subscriptions.payment_method is
  'Forma de pagamento da assinatura vigente, registrada no checkout do Asaas.';
