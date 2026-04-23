alter table public.ifood_settings
  add column if not exists token_type text,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists client_secret_updated_at timestamptz,
  add column if not exists merchant_name text,
  add column if not exists merchant_timezone text,
  add column if not exists merchant_state text,
  add column if not exists merchant_enabled boolean not null default false,
  add column if not exists webhook_url text,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_sync_status text,
  add column if not exists last_sync_message text,
  add column if not exists last_event_at timestamptz,
  add column if not exists auth_mode text not null default 'centralized';

alter table public.ifood_events
  add column if not exists ifood_event_id text,
  add column if not exists order_id text,
  add column if not exists full_code text,
  add column if not exists sales_channel text,
  add column if not exists event_created_at timestamptz,
  add column if not exists source text not null default 'webhook',
  add column if not exists processed_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists processing_error text,
  add column if not exists signature text,
  add column if not exists http_status integer;

create unique index if not exists ifood_events_ifood_event_id_uidx
  on public.ifood_events(ifood_event_id)
  where ifood_event_id is not null;

create index if not exists ifood_events_order_id_idx
  on public.ifood_events(order_id);

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
