-- Recria os objetos da integração iFood quando o histórico de migrations está
-- marcado como aplicado, mas as tabelas não existem no banco de produção.

create table if not exists public.ifood_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_id text,
  client_id text,
  client_secret text,
  authorization_code text,
  access_token text,
  refresh_token text,
  status text not null default 'offline' check (status in ('online', 'offline', 'paused')),
  last_poll timestamptz,
  token_type text,
  access_token_expires_at timestamptz,
  client_secret_updated_at timestamptz,
  merchant_name text,
  merchant_timezone text,
  merchant_state text,
  merchant_enabled boolean not null default false,
  webhook_url text,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_message text,
  last_event_at timestamptz,
  auth_mode text not null default 'centralized',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists ifood_settings_merchant_id_idx
  on public.ifood_settings(merchant_id);

alter table public.ifood_settings enable row level security;

drop policy if exists "Users can view their own ifood settings" on public.ifood_settings;
create policy "Users can view their own ifood settings"
  on public.ifood_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ifood settings" on public.ifood_settings;
create policy "Users can insert their own ifood settings"
  on public.ifood_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ifood settings" on public.ifood_settings;
create policy "Users can update their own ifood settings"
  on public.ifood_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.ifood_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  merchant_id text,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  ifood_event_id text,
  order_id text,
  full_code text,
  sales_channel text,
  event_created_at timestamptz,
  source text not null default 'webhook',
  processed_at timestamptz,
  acknowledged_at timestamptz,
  processing_error text,
  signature text,
  http_status integer
);

create index if not exists ifood_events_user_id_idx on public.ifood_events(user_id);
create index if not exists ifood_events_merchant_id_idx on public.ifood_events(merchant_id);
create index if not exists ifood_events_created_at_idx on public.ifood_events(created_at desc);
create index if not exists ifood_events_order_id_idx on public.ifood_events(order_id);
create unique index if not exists ifood_events_ifood_event_id_uidx
  on public.ifood_events(ifood_event_id)
  where ifood_event_id is not null;

alter table public.ifood_events enable row level security;

drop policy if exists "ifood_events_select_own" on public.ifood_events;
create policy "ifood_events_select_own"
  on public.ifood_events for select
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update on public.ifood_settings to authenticated;
grant select on public.ifood_events to authenticated;
grant all on public.ifood_settings, public.ifood_events to service_role;

notify pgrst, 'reload schema';
