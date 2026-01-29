-- Garante que a tabela existe
create table if not exists public.pix_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  updated_at timestamptz default now()
);

-- Adiciona colunas que podem faltar (idempotente)
alter table public.pix_settings add column if not exists enabled boolean default false;
alter table public.pix_settings add column if not exists bank text default 'mercadopago';
alter table public.pix_settings add column if not exists client_id text;
alter table public.pix_settings add column if not exists client_secret text;
alter table public.pix_settings add column if not exists webhook_secret text;
alter table public.pix_settings add column if not exists pix_key text;
alter table public.pix_settings add column if not exists merchant_name text;
alter table public.pix_settings add column if not exists merchant_city text;
alter table public.pix_settings add column if not exists endpoint_base text;

-- Garante constraint unique no user_id se não existir
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pix_settings_user_id_key') then
    alter table public.pix_settings add constraint pix_settings_user_id_key unique (user_id);
  end if;
end $$;

-- Remove policies antigas para recriar
drop policy if exists "Users can view their own pix settings" on public.pix_settings;
drop policy if exists "Users can insert their own pix settings" on public.pix_settings;
drop policy if exists "Users can update their own pix settings" on public.pix_settings;

-- Habilita RLS
alter table public.pix_settings enable row level security;

-- Recria policies
create policy "Users can view their own pix settings" on public.pix_settings for select using (auth.uid() = user_id);
create policy "Users can insert their own pix settings" on public.pix_settings for insert with check (auth.uid() = user_id);
create policy "Users can update their own pix settings" on public.pix_settings for update using (auth.uid() = user_id);
