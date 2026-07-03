create table if not exists public.restaurant_checklist_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  require_daily boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null default 'operacao',
  shift text not null default 'abertura',
  sort_order integer not null default 0,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_date date not null default current_date,
  status text not null default 'pending',
  checked_task_ids uuid[] not null default '{}',
  notes text,
  completed_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_checklist_runs_status_check check (status in ('pending', 'completed')),
  constraint restaurant_checklist_runs_unique_day unique (user_id, business_date)
);

create index if not exists restaurant_checklist_tasks_user_active_idx
  on public.restaurant_checklist_tasks(user_id, active, sort_order);

create index if not exists restaurant_checklist_runs_user_date_idx
  on public.restaurant_checklist_runs(user_id, business_date desc);

alter table public.restaurant_checklist_settings enable row level security;
alter table public.restaurant_checklist_tasks enable row level security;
alter table public.restaurant_checklist_runs enable row level security;

drop policy if exists restaurant_checklist_settings_owner_select on public.restaurant_checklist_settings;
create policy restaurant_checklist_settings_owner_select
  on public.restaurant_checklist_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists restaurant_checklist_settings_owner_insert on public.restaurant_checklist_settings;
create policy restaurant_checklist_settings_owner_insert
  on public.restaurant_checklist_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists restaurant_checklist_settings_owner_update on public.restaurant_checklist_settings;
create policy restaurant_checklist_settings_owner_update
  on public.restaurant_checklist_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists restaurant_checklist_tasks_owner_select on public.restaurant_checklist_tasks;
create policy restaurant_checklist_tasks_owner_select
  on public.restaurant_checklist_tasks for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists restaurant_checklist_tasks_owner_insert on public.restaurant_checklist_tasks;
create policy restaurant_checklist_tasks_owner_insert
  on public.restaurant_checklist_tasks for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists restaurant_checklist_tasks_owner_update on public.restaurant_checklist_tasks;
create policy restaurant_checklist_tasks_owner_update
  on public.restaurant_checklist_tasks for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists restaurant_checklist_tasks_owner_delete on public.restaurant_checklist_tasks;
create policy restaurant_checklist_tasks_owner_delete
  on public.restaurant_checklist_tasks for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists restaurant_checklist_runs_owner_select on public.restaurant_checklist_runs;
create policy restaurant_checklist_runs_owner_select
  on public.restaurant_checklist_runs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists restaurant_checklist_runs_owner_insert on public.restaurant_checklist_runs;
create policy restaurant_checklist_runs_owner_insert
  on public.restaurant_checklist_runs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists restaurant_checklist_runs_owner_update on public.restaurant_checklist_runs;
create policy restaurant_checklist_runs_owner_update
  on public.restaurant_checklist_runs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
