-- Completa a estrutura de pedidos exigida pela integração iFood. A migration
-- original consta no histórico remoto, mas estas colunas não foram criadas.

alter table public.orders
  add column if not exists source text not null default 'boracume',
  add column if not exists external_order_id text,
  add column if not exists external_merchant_id text,
  add column if not exists external_status text,
  add column if not exists integration_payload jsonb not null default '{}'::jsonb,
  add column if not exists customer_document text,
  add column if not exists pickup_code text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create unique index if not exists orders_external_source_uidx
  on public.orders(user_id, source, external_order_id)
  where external_order_id is not null;

create index if not exists orders_source_status_idx
  on public.orders(user_id, source, status);

notify pgrst, 'reload schema';
