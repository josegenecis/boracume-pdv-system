-- ATENÇÃO: Isso recria a tabela do zero para garantir estrutura
drop table if exists public.pix_settings cascade;

create table public.pix_settings (
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

-- Permissões
alter table public.pix_settings enable row level security;

-- Política permissiva para o dono (ALL = select, insert, update, delete)
create policy "Users can manage own pix settings" 
  on public.pix_settings 
  for all 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Confirmação
select 'Tabela pix_settings recriada com sucesso' as status;
