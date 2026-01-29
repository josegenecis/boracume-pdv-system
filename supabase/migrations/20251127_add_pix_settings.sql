create table if not exists public.pix_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'custom',
  credentials jsonb not null default '{}',
  webhook_secret text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pix_settings enable row level security;

create policy pix_settings_select_owner on public.pix_settings
  for select
  using (auth.uid() = user_id);

create policy pix_settings_insert_owner on public.pix_settings
  for insert
  with check (auth.uid() = user_id);

create policy pix_settings_update_owner on public.pix_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy pix_settings_delete_owner on public.pix_settings
  for delete
  using (auth.uid() = user_id);

