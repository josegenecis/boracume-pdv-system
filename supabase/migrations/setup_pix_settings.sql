create table if not exists public.pix_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  enabled boolean not null default false,
  bank text not null,
  pix_key text not null,
  merchant_name text,
  merchant_city text,
  client_id text,
  client_secret text,
  webhook_secret text,
  endpoint_base text,
  updated_at timestamptz not null default now()
);

alter table public.pix_settings enable row level security;

create policy if not exists "pix_settings_owner_read"
  on public.pix_settings for select
  using (user_id = auth.uid());
create policy if not exists "pix_settings_owner_write"
  on public.pix_settings for insert
  with check (user_id = auth.uid());
create policy if not exists "pix_settings_owner_update"
  on public.pix_settings for update
  using (user_id = auth.uid());
create policy if not exists "pix_settings_owner_delete"
  on public.pix_settings for delete
  using (user_id = auth.uid());
