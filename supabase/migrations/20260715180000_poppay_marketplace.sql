create extension if not exists pgcrypto;

-- Conexao paralela do marketplace PopPay. Os tokens ficam acessiveis somente
-- pelas Edge Functions com service role; a integracao Mercado Pago legada nao
-- e alterada durante a migracao.
create table if not exists public.poppay_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'connected', 'disabled', 'revoked', 'error')),
  enabled boolean not null default false,
  split_enabled boolean not null default false,
  fee_bps integer not null default 100 check (fee_bps between 0 and 1000),
  mp_user_id text,
  access_token text,
  refresh_token text,
  public_key text,
  token_type text,
  scope text,
  expires_at timestamptz,
  connected_at timestamptz,
  disabled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists poppay_connections_status_idx
  on public.poppay_connections (status, split_enabled);

alter table public.poppay_connections enable row level security;

-- Sem policies intencionalmente: credenciais nunca devem ser retornadas ao
-- cliente. Status e ativacao passam pela funcao autenticada poppay-settings.
drop policy if exists "poppay_connections_owner_read" on public.poppay_connections;
drop policy if exists "poppay_connections_owner_write" on public.poppay_connections;

create table if not exists public.poppay_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists poppay_oauth_states_user_created_idx
  on public.poppay_oauth_states (user_id, created_at desc);

alter table public.poppay_oauth_states enable row level security;

create table if not exists public.poppay_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null,
  checkout_id uuid not null references public.pix_checkouts(id) on delete restrict,
  payment_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested', 'in_process', 'approved', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  mp_refund_id text,
  reason text,
  requested_by uuid references auth.users(id) on delete set null,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists poppay_refunds_full_checkout_idx
  on public.poppay_refunds (checkout_id)
  where status <> 'failed';

create index if not exists poppay_refunds_user_created_idx
  on public.poppay_refunds (user_id, created_at desc);

alter table public.poppay_refunds enable row level security;

drop policy if exists "poppay_refunds_owner_read" on public.poppay_refunds;
create policy "poppay_refunds_owner_read"
  on public.poppay_refunds for select
  to authenticated
  using (auth.uid() = user_id);

alter table public.pix_checkouts
  add column if not exists payment_connection text not null default 'legacy',
  add column if not exists platform_fee_bps integer not null default 0,
  add column if not exists platform_fee_cents integer not null default 0,
  add column if not exists refund_status text,
  add column if not exists refunded_cents integer not null default 0;

create index if not exists pix_checkouts_order_paid_idx
  on public.pix_checkouts (order_id, status, updated_at desc);

comment on table public.poppay_connections is
  'Conexoes OAuth da aplicacao Marketplace PopPay, paralelas a integracao Mercado Pago legada.';
comment on column public.poppay_connections.fee_bps is
  'Comissao em basis points. 100 bps = 1%.';
