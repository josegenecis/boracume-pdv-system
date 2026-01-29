create table if not exists public.pix_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  enabled boolean default false,
  bank text default 'mercadopago',
  client_id text,
  client_secret text,
  webhook_secret text,
  pix_key text,
  merchant_name text,
  merchant_city text,
  endpoint_base text,
  updated_at timestamptz default now(),
  constraint pix_settings_user_id_key unique (user_id)
);

alter table public.pix_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'pix_settings' 
    and policyname = 'Users can view their own pix settings'
  ) then
    create policy "Users can view their own pix settings"
      on public.pix_settings for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'pix_settings' 
    and policyname = 'Users can insert their own pix settings'
  ) then
    create policy "Users can insert their own pix settings"
      on public.pix_settings for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'pix_settings' 
    and policyname = 'Users can update their own pix settings'
  ) then
    create policy "Users can update their own pix settings"
      on public.pix_settings for update
      using (auth.uid() = user_id);
  end if;
end $$;
