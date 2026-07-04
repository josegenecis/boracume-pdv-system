create table if not exists public.checkout_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'complete' check (mode in ('express', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkout_settings enable row level security;

drop policy if exists "Usuários gerenciam checkout_settings" on public.checkout_settings;
create policy "Usuários gerenciam checkout_settings"
  on public.checkout_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

