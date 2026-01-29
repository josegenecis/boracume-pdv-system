-- Core tables required by app
create table if not exists public.waiters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  pin text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  description text not null,
  amount numeric(12,2) not null,
  category text,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  initial_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2),
  status text not null default 'open',
  notes text
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_register_sessions(id) on delete cascade,
  user_id uuid not null,
  type text not null check (type in ('in','out')),
  amount numeric(12,2) not null,
  description text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.waiters enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_register_sessions enable row level security;
alter table public.cash_movements enable row level security;

-- Policies: only owner user_id can access
create policy if not exists "waiters_owner_read"
  on public.waiters for select
  using (user_id = auth.uid());
create policy if not exists "waiters_owner_write"
  on public.waiters for insert
  with check (user_id = auth.uid());
create policy if not exists "waiters_owner_update"
  on public.waiters for update
  using (user_id = auth.uid());
create policy if not exists "waiters_owner_delete"
  on public.waiters for delete
  using (user_id = auth.uid());

create policy if not exists "expenses_owner_read"
  on public.expenses for select
  using (user_id = auth.uid());
create policy if not exists "expenses_owner_write"
  on public.expenses for insert
  with check (user_id = auth.uid());
create policy if not exists "expenses_owner_update"
  on public.expenses for update
  using (user_id = auth.uid());
create policy if not exists "expenses_owner_delete"
  on public.expenses for delete
  using (user_id = auth.uid());

create policy if not exists "cash_sessions_owner_read"
  on public.cash_register_sessions for select
  using (user_id = auth.uid());
create policy if not exists "cash_sessions_owner_write"
  on public.cash_register_sessions for insert
  with check (user_id = auth.uid());
create policy if not exists "cash_sessions_owner_update"
  on public.cash_register_sessions for update
  using (user_id = auth.uid());
create policy if not exists "cash_sessions_owner_delete"
  on public.cash_register_sessions for delete
  using (user_id = auth.uid());

create policy if not exists "cash_movements_owner_read"
  on public.cash_movements for select
  using (user_id = auth.uid());
create policy if not exists "cash_movements_owner_write"
  on public.cash_movements for insert
  with check (user_id = auth.uid());
create policy if not exists "cash_movements_owner_update"
  on public.cash_movements for update
  using (user_id = auth.uid());
create policy if not exists "cash_movements_owner_delete"
  on public.cash_movements for delete
  using (user_id = auth.uid());

