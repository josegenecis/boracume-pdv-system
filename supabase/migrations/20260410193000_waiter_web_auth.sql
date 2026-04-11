alter table public.waiters
add column if not exists cpf text;

create unique index if not exists idx_waiters_user_cpf_unique
on public.waiters (user_id, cpf)
where cpf is not null;

create table if not exists public.waiter_web_sessions (
  id uuid primary key default gen_random_uuid(),
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_waiter_web_sessions_waiter_id on public.waiter_web_sessions(waiter_id);
create index if not exists idx_waiter_web_sessions_restaurant_id on public.waiter_web_sessions(restaurant_id);
create index if not exists idx_waiter_web_sessions_expires_at on public.waiter_web_sessions(expires_at);

alter table public.waiter_web_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'waiter_web_sessions'
      and policyname = 'waiter_web_sessions_owner_all'
  ) then
    create policy waiter_web_sessions_owner_all
      on public.waiter_web_sessions
      for all
      using (auth.uid() = restaurant_id)
      with check (auth.uid() = restaurant_id);
  end if;
end $$;
