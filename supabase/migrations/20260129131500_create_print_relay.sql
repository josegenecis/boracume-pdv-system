create table if not exists public.print_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  token_hash text not null unique,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  job_type text not null default 'receipt',
  payload jsonb not null,
  attempts integer not null default 0,
  error text,
  picked_at timestamptz,
  picked_by uuid references public.print_agent_tokens(id),
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_jobs_restaurant_status_created_idx
  on public.print_jobs (restaurant_user_id, status, created_at);

alter table public.print_agent_tokens enable row level security;
alter table public.print_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'print_agent_tokens'
      and policyname = 'Users can manage their own print agent tokens'
  ) then
    create policy "Users can manage their own print agent tokens"
      on public.print_agent_tokens
      for all
      using (auth.uid() = restaurant_user_id)
      with check (auth.uid() = restaurant_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'print_jobs'
      and policyname = 'Users can manage their own print jobs'
  ) then
    create policy "Users can manage their own print jobs"
      on public.print_jobs
      for all
      using (auth.uid() = restaurant_user_id)
      with check (auth.uid() = restaurant_user_id);
  end if;
end $$;
