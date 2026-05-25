alter table public.employee_time_clock_settings
  add column if not exists standard_daily_minutes integer not null default 480,
  add column if not exists standard_weekly_minutes integer not null default 2640,
  add column if not exists minimum_break_minutes integer not null default 60,
  add column if not exists overtime_tolerance_minutes integer not null default 10,
  add column if not exists workdays integer[] not null default array[1,2,3,4,5,6];

create table if not exists public.employee_time_clock_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  occurrence_type text not null check (
    occurrence_type in (
      'vacation',
      'medical_certificate',
      'paid_leave',
      'day_off',
      'holiday',
      'justified_absence',
      'unjustified_absence',
      'manual_adjustment',
      'suspension',
      'other'
    )
  ),
  start_date date not null,
  end_date date not null,
  paid boolean not null default true,
  affects_expected_hours boolean not null default true,
  notes text,
  attachment_url text,
  status text not null default 'approved' check (status in ('approved', 'pending_review', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.employee_time_clock_occurrences enable row level security;

drop policy if exists "Owners can manage time clock occurrences" on public.employee_time_clock_occurrences;
create policy "Owners can manage time clock occurrences"
  on public.employee_time_clock_occurrences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_time_clock_occurrences_user_period
  on public.employee_time_clock_occurrences(user_id, start_date, end_date);

create index if not exists idx_time_clock_occurrences_waiter_period
  on public.employee_time_clock_occurrences(waiter_id, start_date, end_date);
