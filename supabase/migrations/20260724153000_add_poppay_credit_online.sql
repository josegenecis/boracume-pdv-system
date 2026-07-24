alter table public.poppay_connections
  add column if not exists credit_online_enabled boolean not null default false,
  add column if not exists credit_fee_bps integer not null default 50,
  add column if not exists credit_terms_version text,
  add column if not exists credit_terms_accepted_at timestamptz;

alter table public.poppay_connections
  drop constraint if exists poppay_connections_credit_fee_bps_check;

alter table public.poppay_connections
  add constraint poppay_connections_credit_fee_bps_check
  check (credit_fee_bps between 0 and 1000);

alter table public.pix_checkouts
  add column if not exists payment_kind text not null default 'pix',
  add column if not exists provider_fee_cents integer not null default 0,
  add column if not exists net_received_cents integer;

create index if not exists pix_checkouts_payment_kind_status_idx
  on public.pix_checkouts (payment_kind, status, created_at desc);

comment on column public.poppay_connections.credit_online_enabled is
  'Ativacao voluntaria do recebimento por credito online a vista no Cardapio Digital.';
comment on column public.poppay_connections.credit_fee_bps is
  'Tarifa operacional PopPay para credito online. 50 bps = 0,5%. Controlada apenas pelo painel interno.';
comment on column public.pix_checkouts.payment_kind is
  'Tipo do pagamento online: pix ou credit_card.';
