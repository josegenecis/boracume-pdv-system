create table if not exists public.tef_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  enabled boolean not null default false,
  updated_at timestamp with time zone default now()
);

alter table public.tef_settings enable row level security;

create policy if not exists "tef_settings_owner_all"
  on public.tef_settings for all
  using (auth.uid() = user_id);

