create table if not exists public.ifood_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  merchant_id text,
  client_id text,
  client_secret text,
  authorization_code text,
  access_token text,
  refresh_token text,
  status text default 'offline' check (status in ('online', 'offline', 'paused')),
  last_poll timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id)
);

alter table public.ifood_settings enable row level security;

create policy "Users can view their own ifood settings"
  on public.ifood_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ifood settings"
  on public.ifood_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ifood settings"
  on public.ifood_settings for update
  using (auth.uid() = user_id);
