alter table public.pix_settings
add column if not exists mp_access_token text;

alter table public.pix_settings
add column if not exists mp_refresh_token text;

alter table public.pix_settings
add column if not exists mp_token_type text;

alter table public.pix_settings
add column if not exists mp_scope text;

alter table public.pix_settings
add column if not exists mp_user_id text;

alter table public.pix_settings
add column if not exists mp_public_key text;

alter table public.pix_settings
add column if not exists mp_expires_at timestamptz;

create table if not exists public.mp_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (state)
);

create index if not exists mp_oauth_states_user_created_idx
on public.mp_oauth_states (user_id, created_at desc);

alter table public.mp_oauth_states enable row level security;

drop policy if exists "Users can manage their own mp oauth states" on public.mp_oauth_states;
create policy "Users can manage their own mp oauth states"
  on public.mp_oauth_states for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

