create table if not exists public.business_email_automation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hr_email text,
  accounting_email text,
  send_time_clock_monthly boolean not null default true,
  send_nfce_xml_monthly boolean not null default true,
  report_day integer not null default 1 check (report_day between 1 and 28),
  last_time_clock_report_month text,
  last_nfce_xml_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_email_automation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  automation_type text not null check (automation_type in ('time_clock_monthly_report', 'nfce_xml_monthly')),
  period_start date not null,
  period_end date not null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  message text,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.business_email_automation_settings enable row level security;
alter table public.business_email_automation_logs enable row level security;

drop policy if exists "Owners can manage email automation settings" on public.business_email_automation_settings;
create policy "Owners can manage email automation settings"
  on public.business_email_automation_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can read email automation logs" on public.business_email_automation_logs;
create policy "Owners can read email automation logs"
  on public.business_email_automation_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert email automation logs" on public.business_email_automation_logs;
create policy "Owners can insert email automation logs"
  on public.business_email_automation_logs
  for insert
  with check (auth.uid() = user_id);

create index if not exists idx_business_email_automation_logs_user_created
  on public.business_email_automation_logs(user_id, created_at desc);

create index if not exists idx_business_email_automation_logs_type_period
  on public.business_email_automation_logs(automation_type, period_start, period_end);
