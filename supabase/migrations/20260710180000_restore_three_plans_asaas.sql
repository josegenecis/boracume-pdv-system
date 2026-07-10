alter table public.subscription_plans
  add column if not exists slug text,
  add column if not exists stripe_price_id text,
  add column if not exists included_stores integer default 1,
  add column if not exists store_limit integer,
  add column if not exists extra_store_price numeric(10,2) default 0,
  add column if not exists is_public boolean default true,
  add column if not exists sort_order integer default 99,
  add column if not exists checkout_note text,
  add column if not exists billing_provider text default 'asaas',
  add column if not exists asaas_plan_code text;

alter table public.subscriptions
  add column if not exists billing_provider text default 'asaas',
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists store_count integer default 1,
  add column if not exists additional_store_count integer default 0,
  add column if not exists extra_store_price numeric(10,2) default 0;

create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text not null,
  asaas_payment_id text,
  asaas_subscription_id text,
  payload jsonb not null,
  processed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_asaas_webhook_events_subscription
  on public.asaas_webhook_events (asaas_subscription_id);

create index if not exists idx_asaas_webhook_events_payment
  on public.asaas_webhook_events (asaas_payment_id);

insert into public.subscription_plans (
  id,
  name,
  slug,
  description,
  price,
  features,
  included_stores,
  store_limit,
  extra_store_price,
  is_public,
  sort_order,
  checkout_note,
  billing_provider,
  asaas_plan_code,
  stripe_price_id
) values
  (
    1,
    'Essencial',
    'essencial',
    'Plano de entrada para restaurante começar a operar com cardápio digital, pedidos e PDV.',
    159.00,
    '["Cardápio digital", "Pedidos online", "PDV básico", "Impressão de pedidos", "WhatsApp conectado", "Relatórios essenciais"]'::jsonb,
    1,
    1,
    0,
    true,
    1,
    'Cobrança mensal processada pelo Asaas.',
    'asaas',
    null,
    null
  ),
  (
    2,
    'Pro',
    'pro',
    'Plano completo para restaurante que precisa de automação, estoque, mesas e gestão avançada.',
    229.00,
    '["Tudo do Essencial", "Mesas e comandas", "Controle de estoque", "Financeiro completo", "PopMarketing AI", "Atendente virtual", "Fiscal NFC-e quando habilitado", "App garçom"]'::jsonb,
    1,
    1,
    0,
    true,
    2,
    'Cobrança mensal processada pelo Asaas.',
    'asaas',
    null,
    null
  ),
  (
    3,
    'Multi',
    'multi',
    'Plano para operação multilojas, com visão consolidada e cobrança por loja adicional.',
    269.00,
    '["Tudo do Pro", "Multi lojas", "Painel consolidado por loja", "Troca rápida de unidades", "Permissões por unidade", "Relatórios por loja e grupo", "Suporte para expansão"]'::jsonb,
    1,
    null,
    149.00,
    true,
    3,
    'R$269,00 por mês com 1 loja incluída. Cada loja adicional soma R$149,00 na mensalidade.',
    'asaas',
    null,
    null
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  price = excluded.price,
  features = excluded.features,
  included_stores = excluded.included_stores,
  store_limit = excluded.store_limit,
  extra_store_price = excluded.extra_store_price,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  checkout_note = excluded.checkout_note,
  billing_provider = excluded.billing_provider,
  asaas_plan_code = excluded.asaas_plan_code,
  stripe_price_id = null;

update public.subscription_plans
set stripe_price_id = null,
    billing_provider = 'asaas'
where id in (1, 2, 3);
