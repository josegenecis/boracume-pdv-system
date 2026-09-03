-- Central da Equipe PopSystem
-- Cadastro canônico, retrocompatível com waiters, delivery_personnel e ponto.
create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  display_name text,
  cpf text,
  phone text,
  email text,
  birth_date date,
  address text,
  photo_url text,
  hire_date date,
  job_title text,
  department text,
  unit_name text,
  employment_status text not null default 'active'
    check (employment_status in ('active','leave','vacation','terminated')),
  employment_type text not null default 'monthly'
    check (employment_type in ('hourly','daily','weekly','monthly','clt','freelance','partner','intern','other')),
  weekly_hours numeric(8,2) not null default 44 check (weekly_hours >= 0 and weekly_hours <= 168),
  standard_workday jsonb not null default '{}'::jsonb,
  default_day_off smallint check (default_day_off between 0 and 6),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create unique index if not exists employees_restaurant_cpf_uidx
  on public.employees(restaurant_id, cpf) where cpf is not null and length(cpf) = 11;
create index if not exists employees_restaurant_status_idx
  on public.employees(restaurant_id, employment_status, full_name);

create table if not exists public.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  salary_base numeric(12,2) not null default 0 check (salary_base >= 0),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  remuneration_type text not null default 'fixed'
    check (remuneration_type in ('fixed','hourly','daily','weekly','commission','mixed','other')),
  default_bonus numeric(12,2) not null default 0 check (default_bonus >= 0),
  pix_key text,
  bank_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.employee_roles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_code text not null check (role_code in (
    'administrator','manager','cashier','waiter','kitchen','driver','stockkeeper','finance','hr','custom'
  )),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(employee_id, role_code)
);

create table if not exists public.employee_permissions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  permission_code text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique(employee_id, permission_code)
);

create table if not exists public.employee_app_access (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  app_code text not null check (app_code in (
    'popsystem','pdv','waiter','driver','time_clock','kds','finance','stock','administration'
  )),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique(employee_id, app_code)
);

create table if not exists public.employee_work_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_type text not null default 'fixed' check (schedule_type in ('fixed','variable')),
  weekday smallint not null check (weekday between 0 and 6),
  first_start time,
  first_end time,
  second_start time,
  second_end time,
  is_day_off boolean not null default false,
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (effective_until is null or effective_until >= effective_from),
  check (is_day_off or (first_start is not null and first_end is not null)),
  unique(employee_id, weekday, effective_from)
);

create table if not exists public.employee_time_entry_corrections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  original_event_id uuid not null references public.employee_time_clock_events(id) on delete restrict,
  corrected_event_id uuid references public.employee_time_clock_events(id) on delete restrict,
  original_snapshot jsonb not null,
  corrected_snapshot jsonb not null,
  reason text not null check (length(trim(reason)) >= 5),
  corrected_by uuid references public.waiters(id) on delete set null,
  corrected_by_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_commission_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  rule_type text not null check (rule_type in ('sale_percentage','fixed_per_sale','product_percentage','product_fixed','service_percentage','service_fixed')),
  percentage numeric(8,4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  fixed_amount numeric(12,2) check (fixed_amount is null or fixed_amount >= 0),
  product_id uuid references public.products(id) on delete cascade,
  active boolean not null default true,
  starts_at date not null default current_date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  check (percentage is not null or fixed_amount is not null),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.employee_commissions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  commission_rule_id uuid references public.employee_commission_rules(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('sale','product','service','waiter_service_charge','manual','bonus')),
  source_id uuid,
  competence_date date not null default current_date,
  base_amount numeric(12,2) not null default 0,
  amount numeric(12,2) not null check (amount >= 0),
  description text,
  status text not null default 'pending' check (status in ('pending','included','paid','cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create unique index if not exists employee_commissions_rule_source_uidx
  on public.employee_commissions(restaurant_id, commission_rule_id, source_type, source_id, employee_id)
  where source_id is not null and commission_rule_id is not null;
create unique index if not exists employee_commissions_external_source_uidx
  on public.employee_commissions(restaurant_id, source_type, source_id, employee_id)
  where source_id is not null and commission_rule_id is null;

create table if not exists public.employee_advances (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  advance_date date not null default current_date,
  payment_method text not null,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  financial_movement_id uuid references public.financial_movements(id) on delete restrict,
  note text,
  status text not null default 'posted' check (status in ('posted','included','reversed')),
  reversed_at timestamptz,
  reversal_reason text,
  reversed_by uuid references public.waiters(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.employee_payroll_settings (
  restaurant_id uuid primary key references auth.users(id) on delete cascade,
  overtime_tolerance_minutes integer not null default 10 check (overtime_tolerance_minutes >= 0),
  late_tolerance_minutes integer not null default 5 check (late_tolerance_minutes >= 0),
  overtime_hour_multiplier numeric(8,4) not null default 1 check (overtime_hour_multiplier >= 0),
  deduct_late_minutes boolean not null default false,
  deduct_unjustified_absences boolean not null default false,
  alert_overtime_minutes integer not null default 120 check (alert_overtime_minutes >= 0),
  alert_absence_count integer not null default 3 check (alert_absence_count >= 0),
  default_payable_due_day smallint not null default 5 check (default_payable_due_day between 1 and 28),
  custom_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.employee_payroll_closings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  competence_date date not null,
  unit_name text,
  status text not null default 'calculating' check (status in (
    'calculating','review','approved','generated_financial','paid','cancelled'
  )),
  total_earnings numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_net numeric(14,2) not null default 0,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by uuid references public.waiters(id) on delete set null,
  approved_by_name text,
  reopened_at timestamptz,
  reopened_by uuid references public.waiters(id) on delete set null,
  reopened_by_name text,
  reopen_reason text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id, competence_date, unit_name)
);
create unique index if not exists employee_payroll_closing_scope_uidx
  on public.employee_payroll_closings(restaurant_id, competence_date, coalesce(unit_name,''));

create table if not exists public.employee_payroll_items (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.employee_payroll_closings(id) on delete cascade,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  base_salary numeric(12,2) not null default 0,
  expected_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  late_minutes integer not null default 0,
  early_leave_minutes integer not null default 0,
  absence_days numeric(8,2) not null default 0,
  days_off integer not null default 0,
  worked_days integer not null default 0,
  commissions numeric(12,2) not null default 0,
  bonuses numeric(12,2) not null default 0,
  advances numeric(12,2) not null default 0,
  other_earnings numeric(12,2) not null default 0,
  absence_deductions numeric(12,2) not null default 0,
  late_deductions numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  total_earnings numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','payable_generated','paid','cancelled')),
  expense_id uuid references public.expenses(id) on delete set null,
  calculation_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(closing_id, employee_id)
);

create table if not exists public.employee_payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  closing_id uuid not null references public.employee_payroll_closings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('earning','deduction')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.waiters(id) on delete set null,
  created_by_name text not null
);

create table if not exists public.employee_audit_log (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_waiter_id uuid references public.waiters(id) on delete set null,
  actor_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_alerts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  title text not null,
  description text,
  reference_date date not null default current_date,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.waiters(id) on delete set null
);

-- Projeções legadas continuam ativas durante a migração dos aplicativos.
alter table public.waiters add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.delivery_personnel add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.employee_time_clock_devices add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.employee_time_clock_events add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.employee_time_clock_occurrences add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.waiter_service_charges add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.delivery_driver_ledger add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.expenses add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.expenses add column if not exists payroll_closing_id uuid references public.employee_payroll_closings(id) on delete set null;

create unique index if not exists waiters_employee_uidx on public.waiters(employee_id) where employee_id is not null;
create unique index if not exists delivery_personnel_employee_uidx on public.delivery_personnel(employee_id) where employee_id is not null;

create or replace function public.fill_employee_id_from_waiter()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.employee_id is null and new.waiter_id is not null then
    select employee_id into new.employee_id from public.waiters where id=new.waiter_id;
  end if;
  return new;
end; $$;

drop trigger if exists time_clock_devices_fill_employee on public.employee_time_clock_devices;
create trigger time_clock_devices_fill_employee before insert or update of waiter_id on public.employee_time_clock_devices
for each row execute function public.fill_employee_id_from_waiter();
drop trigger if exists time_clock_events_fill_employee on public.employee_time_clock_events;
create trigger time_clock_events_fill_employee before insert or update of waiter_id on public.employee_time_clock_events
for each row execute function public.fill_employee_id_from_waiter();
drop trigger if exists time_clock_occurrences_fill_employee on public.employee_time_clock_occurrences;
create trigger time_clock_occurrences_fill_employee before insert or update of waiter_id on public.employee_time_clock_occurrences
for each row execute function public.fill_employee_id_from_waiter();
drop trigger if exists service_charges_fill_employee on public.waiter_service_charges;
create trigger service_charges_fill_employee before insert or update of waiter_id on public.waiter_service_charges
for each row execute function public.fill_employee_id_from_waiter();

create or replace function public.fill_employee_id_from_driver()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.employee_id is null and new.delivery_personnel_id is not null then
    select employee_id into new.employee_id from public.delivery_personnel where id=new.delivery_personnel_id;
  end if;
  return new;
end; $$;
drop trigger if exists driver_ledger_fill_employee on public.delivery_driver_ledger;
create trigger driver_ledger_fill_employee before insert or update of delivery_personnel_id on public.delivery_driver_ledger
for each row execute function public.fill_employee_id_from_driver();

-- Todo usuário/garçom atual vira colaborador sem perder seu UUID nem seus dados.
insert into public.employees(
  id, restaurant_id, full_name, display_name, cpf, email, hire_date, job_title,
  employment_status, employment_type, weekly_hours, created_at, created_by, updated_by
)
select
  waiter.id, waiter.user_id, waiter.name, waiter.name, nullif(regexp_replace(coalesce(waiter.cpf,''), '\D', '', 'g'), ''),
  nullif(trim(coalesce(waiter.email,'')), ''), waiter.hire_date, waiter.job_title,
  case when waiter.active then 'active' else 'terminated' end,
  coalesce(waiter.employment_type, 'monthly'), coalesce(waiter.weekly_hours, 44),
  coalesce(waiter.created_at, now()), waiter.user_id, waiter.user_id
from public.waiters waiter
on conflict (id) do nothing;

update public.waiters waiter set employee_id = waiter.id where waiter.employee_id is null;

insert into public.employee_compensation(employee_id, restaurant_id, salary_base, hourly_rate, remuneration_type, updated_by)
select waiter.employee_id, waiter.user_id, coalesce(waiter.salary_amount,0), coalesce(waiter.hourly_rate,0),
  case coalesce(waiter.employment_type,'monthly') when 'hourly' then 'hourly' when 'daily' then 'daily' when 'weekly' then 'weekly' else 'fixed' end,
  waiter.user_id
from public.waiters waiter where waiter.employee_id is not null
on conflict (employee_id) do update set
  salary_base = excluded.salary_base, hourly_rate = excluded.hourly_rate,
  remuneration_type = excluded.remuneration_type, updated_at = now();

-- Motoboys são ligados por CPF ao mesmo colaborador; os restantes ganham cadastro canônico.
update public.delivery_personnel driver
set employee_id = employee.id
from public.employees employee
where driver.employee_id is null
  and employee.restaurant_id = driver.user_id
  and employee.cpf is not null
  and employee.cpf = nullif(regexp_replace(coalesce(driver.cpf,''), '\D', '', 'g'), '');

insert into public.employees(id, restaurant_id, full_name, display_name, cpf, phone, employment_status, job_title, created_at, created_by, updated_by)
select driver.id, driver.user_id, driver.name, driver.name,
  nullif(regexp_replace(coalesce(driver.cpf,''), '\D', '', 'g'), ''), driver.phone,
  'active', 'Motoboy', coalesce(driver.created_at, now()), driver.user_id, driver.user_id
from public.delivery_personnel driver
where driver.employee_id is null
on conflict (id) do nothing;

update public.delivery_personnel driver
set employee_id = driver.id
where driver.employee_id is null and exists (select 1 from public.employees employee where employee.id = driver.id);

insert into public.employee_roles(restaurant_id, employee_id, role_code, created_by)
select waiter.user_id, waiter.employee_id,
  case when waiter.role = 'admin' or coalesce((waiter.permissions->>'admin')::boolean,false)
    then 'administrator' else 'cashier' end,
  waiter.user_id
from public.waiters waiter where waiter.employee_id is not null
on conflict (employee_id, role_code) do nothing;

insert into public.employee_roles(restaurant_id, employee_id, role_code, created_by)
select driver.user_id, driver.employee_id, 'driver', driver.user_id
from public.delivery_personnel driver where driver.employee_id is not null
on conflict (employee_id, role_code) do nothing;

insert into public.employee_permissions(restaurant_id, employee_id, permission_code, allowed, updated_by)
select waiter.user_id, waiter.employee_id, permission.key, true, waiter.user_id
from public.waiters waiter
cross join lateral jsonb_each_text(coalesce(waiter.permissions,'{}'::jsonb)) permission
where waiter.employee_id is not null and lower(permission.value) = 'true'
on conflict (employee_id, permission_code) do update set allowed = true, updated_at = now();

insert into public.employee_app_access(restaurant_id, employee_id, app_code, enabled, configuration, updated_by)
select waiter.user_id, waiter.employee_id, app.app_code, app.enabled, '{}'::jsonb, waiter.user_id
from public.waiters waiter
cross join lateral (values
  ('popsystem', waiter.active),
  ('pdv', waiter.active and coalesce((waiter.permissions->>'pos_access')::boolean,false)),
  ('waiter', waiter.active and coalesce((waiter.permissions->>'waiter_app')::boolean,false)),
  ('time_clock', waiter.active),
  ('kds', waiter.active and coalesce((waiter.permissions->>'kds_access')::boolean,false)),
  ('finance', waiter.active and coalesce((waiter.permissions->>'financial_view')::boolean,false)),
  ('stock', waiter.active and coalesce((waiter.permissions->>'stock_manage')::boolean,false)),
  ('administration', waiter.active and (waiter.role = 'admin' or coalesce((waiter.permissions->>'admin')::boolean,false)))
) app(app_code, enabled)
where waiter.employee_id is not null
on conflict (employee_id, app_code) do update set enabled = excluded.enabled, updated_at = now();

insert into public.employee_app_access(restaurant_id, employee_id, app_code, enabled, configuration, updated_by)
select driver.user_id, driver.employee_id, 'driver', coalesce(driver.app_enabled,false),
  jsonb_build_object('vehicle_type',driver.vehicle_type,'vehicle_plate',driver.vehicle_plate), driver.user_id
from public.delivery_personnel driver where driver.employee_id is not null
on conflict (employee_id, app_code) do update set enabled = excluded.enabled, configuration = excluded.configuration, updated_at = now();

update public.employee_time_clock_devices target set employee_id = waiter.employee_id
from public.waiters waiter where target.employee_id is null and target.waiter_id = waiter.id;
update public.employee_time_clock_events target set employee_id = waiter.employee_id
from public.waiters waiter where target.employee_id is null and target.waiter_id = waiter.id;
update public.employee_time_clock_occurrences target set employee_id = waiter.employee_id
from public.waiters waiter where target.employee_id is null and target.waiter_id = waiter.id;
update public.waiter_service_charges target set employee_id = waiter.employee_id
from public.waiters waiter where target.employee_id is null and target.waiter_id = waiter.id;
update public.delivery_driver_ledger target set employee_id = driver.employee_id
from public.delivery_personnel driver where target.employee_id is null and target.delivery_personnel_id = driver.id;

-- Taxas de serviço existentes entram como comissão sem duplicação.
insert into public.employee_commissions(
  restaurant_id, employee_id, source_type, source_id, competence_date, base_amount, amount, description, status, created_by
)
select charge.user_id, charge.employee_id, 'waiter_service_charge', charge.id,
  coalesce(charge.created_at::date,current_date), coalesce(charge.base_amount,0), coalesce(charge.net_waiter_amount,charge.gross_amount,0),
  'Taxa de serviço de mesa', 'pending', charge.user_id
from public.waiter_service_charges charge
where charge.employee_id is not null and coalesce(charge.net_waiter_amount,charge.gross_amount,0) >= 0
on conflict do nothing;

-- Índices das consultas mensais e do dashboard.
create index if not exists employee_roles_restaurant_idx on public.employee_roles(restaurant_id, role_code);
create index if not exists employee_permissions_employee_idx on public.employee_permissions(employee_id, allowed);
create index if not exists employee_app_access_employee_idx on public.employee_app_access(employee_id, enabled);
create index if not exists employee_schedules_period_idx on public.employee_work_schedules(employee_id, effective_from, effective_until);
create index if not exists employee_commissions_period_idx on public.employee_commissions(restaurant_id, competence_date, status);
create index if not exists employee_advances_period_idx on public.employee_advances(restaurant_id, advance_date, status);
create index if not exists employee_payroll_period_idx on public.employee_payroll_closings(restaurant_id, competence_date, status);
create index if not exists employee_alerts_open_idx on public.employee_alerts(restaurant_id, status, reference_date desc);
create index if not exists employee_audit_employee_idx on public.employee_audit_log(restaurant_id, employee_id, created_at desc);

-- RLS por empresa. Dados financeiros sensíveis ficam limitados à conta proprietária;
-- a interface também exige permissão operacional antes de consultá-los.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'employees','employee_roles','employee_permissions','employee_app_access','employee_work_schedules',
    'employee_time_entry_corrections','employee_commission_rules','employee_commissions','employee_alerts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists team_store_access on public.%I', table_name);
    execute format('create policy team_store_access on public.%I for all to authenticated using (public.can_access_store(restaurant_id)) with check (public.can_access_store(restaurant_id))', table_name);
  end loop;

  foreach table_name in array array[
    'employee_compensation','employee_advances','employee_payroll_settings','employee_payroll_closings',
    'employee_payroll_items','employee_payroll_adjustments','employee_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists team_owner_sensitive_access on public.%I', table_name);
    execute format('create policy team_owner_sensitive_access on public.%I for all to authenticated using (public.can_access_store(restaurant_id)) with check (public.can_access_store(restaurant_id))', table_name);
  end loop;
end $$;

grant select on public.employees, public.employee_roles, public.employee_permissions,
  public.employee_app_access, public.employee_work_schedules, public.employee_time_entry_corrections,
  public.employee_commission_rules, public.employee_commissions, public.employee_alerts to authenticated;
grant insert, update on public.employees, public.employee_work_schedules to authenticated;
grant select on public.employee_compensation, public.employee_advances, public.employee_payroll_settings,
  public.employee_payroll_closings, public.employee_payroll_items, public.employee_payroll_adjustments to authenticated;
grant insert, update on public.employee_payroll_settings to authenticated;
grant select on public.employee_audit_log to authenticated;

create or replace function public.audit_employee_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_employee_id uuid;
  v_restaurant_id uuid;
begin
  if tg_op='DELETE' then
    v_employee_id:=old.id;
    v_restaurant_id:=old.restaurant_id;
  else
    v_employee_id:=new.id;
    v_restaurant_id:=new.restaurant_id;
  end if;
  insert into public.employee_audit_log(
    restaurant_id, employee_id, entity_type, entity_id, action, before_data, after_data, actor_name
  ) values (
    v_restaurant_id, v_employee_id, 'employee', v_employee_id::text, lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'Usuário autenticado'
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists employees_audit on public.employees;
create trigger employees_audit after insert or update or delete on public.employees
for each row execute function public.audit_employee_changes();

create or replace function public.sync_employee_projection_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.waiters waiter set
    name=new.full_name,
    cpf=new.cpf,
    email=new.email,
    hire_date=new.hire_date,
    job_title=new.job_title,
    employment_type=case when new.employment_type in('hourly','daily','weekly','monthly','clt','freelance') then new.employment_type else 'freelance' end,
    weekly_hours=new.weekly_hours,
    active=new.employment_status='active' and exists(
      select 1 from public.employee_app_access access
      where access.employee_id=new.id and access.enabled=true and access.app_code in('popsystem','pdv','waiter','time_clock','kds','finance','stock','administration')
    )
  where waiter.employee_id=new.id;
  update public.delivery_personnel driver set
    name=new.full_name,
    phone=coalesce(new.phone,driver.phone),
    cpf=new.cpf,
    app_enabled=new.employment_status='active' and exists(
      select 1 from public.employee_app_access access where access.employee_id=new.id and access.enabled=true and access.app_code='driver'
    ),
    status=case when new.employment_status='active' then driver.status else 'offline' end,
    updated_at=now()
  where driver.employee_id=new.id;
  return new;
end; $$;
drop trigger if exists employees_sync_projections on public.employees;
create trigger employees_sync_projections after update of full_name,cpf,email,phone,hire_date,job_title,employment_type,weekly_hours,employment_status on public.employees
for each row execute function public.sync_employee_projection_status();

create or replace function public.audit_employee_compensation_changes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.employee_audit_log(
    restaurant_id,employee_id,entity_type,entity_id,action,before_data,after_data,actor_name
  ) values (
    new.restaurant_id,new.employee_id,'employee_compensation',new.employee_id::text,
    case when tg_op='INSERT' then 'created' else 'updated' end,
    case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new),'Usuário autenticado'
  );
  return new;
end; $$;
drop trigger if exists employee_compensation_audit on public.employee_compensation;
create trigger employee_compensation_audit after insert or update on public.employee_compensation
for each row execute function public.audit_employee_compensation_changes();

create or replace function public.record_employee_commission(
  p_employee_id uuid,
  p_amount numeric,
  p_competence_date date,
  p_description text,
  p_source_type text default 'manual',
  p_operator_id uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_employee public.employees%rowtype; v_id uuid; v_actor text := 'Administrador';
begin
  select * into v_employee from public.employees where id=p_employee_id and public.can_access_store(restaurant_id);
  if not found then raise exception 'Colaborador não encontrado ou acesso não autorizado.'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_source_type not in ('manual','bonus') then raise exception 'Tipo de lançamento manual inválido.'; end if;
  if p_operator_id is not null then
    select name into v_actor from public.waiters where id=p_operator_id and user_id=v_employee.restaurant_id and active=true
      and (role='admin' or coalesce((permissions->>'admin')::boolean,false)
        or coalesce((permissions->>'commission_manage')::boolean,false)
        or coalesce((permissions->>'payroll_manage')::boolean,false));
    if v_actor is null then raise exception 'Operador sem permissão para lançar comissões.'; end if;
  end if;
  insert into public.employee_commissions(
    restaurant_id,employee_id,source_type,competence_date,base_amount,amount,description,status,created_by
  ) values (
    v_employee.restaurant_id,v_employee.id,p_source_type,coalesce(p_competence_date,current_date),round(p_amount,2),
    round(p_amount,2),nullif(trim(coalesce(p_description,'')),''),'pending',auth.uid()
  ) returning id into v_id;
  insert into public.employee_audit_log(
    restaurant_id,employee_id,entity_type,entity_id,action,after_data,actor_waiter_id,actor_name
  ) values (
    v_employee.restaurant_id,v_employee.id,'commission',v_id::text,'posted',
    jsonb_build_object('amount',round(p_amount,2),'source_type',p_source_type,'competence_date',p_competence_date),
    p_operator_id,v_actor
  );
  return v_id;
end; $$;
revoke all on function public.record_employee_commission(uuid,numeric,date,text,text,uuid) from public;
grant execute on function public.record_employee_commission(uuid,numeric,date,text,text,uuid) to authenticated;

create or replace function public.save_employee_commission_rule(
  p_restaurant_id uuid,
  p_rule_id uuid,
  p_employee_id uuid,
  p_rule_type text,
  p_percentage numeric,
  p_fixed_amount numeric,
  p_product_id uuid,
  p_active boolean,
  p_starts_at date,
  p_ends_at date,
  p_operator_id uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid := coalesce(p_rule_id,gen_random_uuid()); v_actor text := 'Administrador'; v_before jsonb;
begin
  if not public.can_access_store(p_restaurant_id) then raise exception 'Acesso não autorizado à loja.'; end if;
  if not exists(select 1 from public.employees where id=p_employee_id and restaurant_id=p_restaurant_id) then
    raise exception 'Colaborador inválido.';
  end if;
  if p_rule_type not in ('sale_percentage','fixed_per_sale','product_percentage','product_fixed') then
    raise exception 'Tipo de regra inválido.';
  end if;
  if p_rule_type like 'product_%' and not exists(select 1 from public.products where id=p_product_id and user_id=p_restaurant_id) then
    raise exception 'Selecione um produto válido.';
  end if;
  if p_rule_type like '%percentage' and (p_percentage is null or p_percentage<0 or p_percentage>100) then
    raise exception 'Informe um percentual entre 0 e 100.';
  end if;
  if p_rule_type in ('fixed_per_sale','product_fixed') and coalesce(p_fixed_amount,-1)<0 then
    raise exception 'Informe um valor fixo válido.';
  end if;
  if p_ends_at is not null and p_ends_at<coalesce(p_starts_at,current_date) then raise exception 'Período inválido.'; end if;
  if p_operator_id is not null then
    select name into v_actor from public.waiters where id=p_operator_id and user_id=p_restaurant_id and active=true
      and (role='admin' or coalesce((permissions->>'admin')::boolean,false)
        or coalesce((permissions->>'commission_manage')::boolean,false)
        or coalesce((permissions->>'payroll_manage')::boolean,false));
    if v_actor is null then raise exception 'Operador sem permissão para configurar comissões.'; end if;
  end if;
  select to_jsonb(rule) into v_before from public.employee_commission_rules rule where id=v_id and restaurant_id=p_restaurant_id;
  insert into public.employee_commission_rules(
    id,restaurant_id,employee_id,rule_type,percentage,fixed_amount,product_id,active,starts_at,ends_at,created_by,updated_by
  ) values (
    v_id,p_restaurant_id,p_employee_id,p_rule_type,
    case when p_rule_type like '%percentage' then p_percentage else null end,
    case when p_rule_type in ('fixed_per_sale','product_fixed') then p_fixed_amount else null end,
    case when p_rule_type like 'product_%' then p_product_id else null end,
    coalesce(p_active,true),coalesce(p_starts_at,current_date),p_ends_at,auth.uid(),auth.uid()
  ) on conflict(id) do update set employee_id=excluded.employee_id,rule_type=excluded.rule_type,
    percentage=excluded.percentage,fixed_amount=excluded.fixed_amount,product_id=excluded.product_id,
    active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_by=auth.uid(),updated_at=now()
  where employee_commission_rules.restaurant_id=p_restaurant_id;
  insert into public.employee_audit_log(
    restaurant_id,employee_id,entity_type,entity_id,action,before_data,after_data,actor_waiter_id,actor_name
  ) select p_restaurant_id,p_employee_id,'commission_rule',v_id::text,
    case when v_before is null then 'created' else 'updated' end,v_before,to_jsonb(rule),p_operator_id,v_actor
    from public.employee_commission_rules rule where rule.id=v_id;
  return v_id;
end; $$;
revoke all on function public.save_employee_commission_rule(uuid,uuid,uuid,text,numeric,numeric,uuid,boolean,date,date,uuid) from public;
grant execute on function public.save_employee_commission_rule(uuid,uuid,uuid,text,numeric,numeric,uuid,boolean,date,date,uuid) to authenticated;

create or replace function public.team_json_numeric(p_value jsonb,p_key text,p_default numeric default 0)
returns numeric language plpgsql immutable set search_path=public as $$
begin
  return coalesce(nullif(p_value->>p_key,'')::numeric,p_default);
exception when invalid_text_representation or numeric_value_out_of_range then
  return p_default;
end; $$;

create or replace function public.refresh_employee_commissions(
  p_restaurant_id uuid, p_start_date date, p_end_date date
)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer := 0; v_added integer := 0;
begin
  if not public.can_access_store(p_restaurant_id) then raise exception 'Acesso não autorizado à loja.'; end if;
  if p_end_date<p_start_date then raise exception 'Período inválido.'; end if;

  insert into public.employee_commissions(
    restaurant_id,employee_id,commission_rule_id,source_type,source_id,competence_date,base_amount,amount,description,status,created_by
  )
  select p_restaurant_id,rule.employee_id,rule.id,'sale',sale.id,sale.created_at::date,
    greatest(coalesce(sale.total,0)-coalesce(sale.delivery_fee,0),0),
    round(case when rule.rule_type='sale_percentage'
      then greatest(coalesce(sale.total,0)-coalesce(sale.delivery_fee,0),0)*coalesce(rule.percentage,0)/100
      else coalesce(rule.fixed_amount,0) end,2),
    case when rule.rule_type='sale_percentage' then concat('Comissão ',rule.percentage,'% da venda #',coalesce(sale.order_number,sale.id::text))
      else concat('Comissão fixa da venda #',coalesce(sale.order_number,sale.id::text)) end,
    'pending',auth.uid()
  from public.employee_commission_rules rule
  join public.waiters waiter on waiter.employee_id=rule.employee_id and waiter.user_id=p_restaurant_id
  join public.orders sale on sale.waiter_id=waiter.id and sale.user_id=p_restaurant_id
  where rule.restaurant_id=p_restaurant_id and rule.active=true and rule.rule_type in ('sale_percentage','fixed_per_sale')
    and sale.status in ('completed','delivered') and sale.created_at::date between p_start_date and p_end_date
    and sale.created_at::date between rule.starts_at and coalesce(rule.ends_at,sale.created_at::date)
  on conflict do nothing;
  get diagnostics v_count=row_count;

  insert into public.employee_commissions(
    restaurant_id,employee_id,commission_rule_id,source_type,source_id,competence_date,base_amount,amount,description,status,created_by
  )
  select p_restaurant_id,rule.employee_id,rule.id,'product',sale.id,sale.created_at::date,
    sum(coalesce(public.team_json_numeric(item,'subtotal',null),
      public.team_json_numeric(item,'price',0)*public.team_json_numeric(item,'quantity',1))),
    round(case when rule.rule_type='product_percentage' then
      sum(coalesce(public.team_json_numeric(item,'subtotal',null),
        public.team_json_numeric(item,'price',0)*public.team_json_numeric(item,'quantity',1)))*coalesce(rule.percentage,0)/100
      else sum(public.team_json_numeric(item,'quantity',1))*coalesce(rule.fixed_amount,0) end,2),
    concat('Comissão do produto na venda #',coalesce(sale.order_number,sale.id::text)),'pending',auth.uid()
  from public.employee_commission_rules rule
  join public.waiters waiter on waiter.employee_id=rule.employee_id and waiter.user_id=p_restaurant_id
  join public.orders sale on sale.waiter_id=waiter.id and sale.user_id=p_restaurant_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(sale.items)='array' then sale.items else '[]'::jsonb end) item
  where rule.restaurant_id=p_restaurant_id and rule.active=true and rule.rule_type in ('product_percentage','product_fixed')
    and sale.status in ('completed','delivered') and sale.created_at::date between p_start_date and p_end_date
    and sale.created_at::date between rule.starts_at and coalesce(rule.ends_at,sale.created_at::date)
    and item->>'product_id'=rule.product_id::text
  group by rule.id,rule.employee_id,rule.rule_type,rule.percentage,rule.fixed_amount,sale.id,sale.created_at,sale.order_number
  on conflict do nothing;
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;
  return v_count;
end; $$;
revoke all on function public.refresh_employee_commissions(uuid,date,date) from public;
grant execute on function public.refresh_employee_commissions(uuid,date,date) to authenticated;

create or replace function public.register_employee_payroll_adjustment(
  p_closing_id uuid,p_employee_id uuid,p_adjustment_type text,p_category text,p_amount numeric,
  p_description text,p_operator_id uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_closing public.employee_payroll_closings%rowtype; v_id uuid; v_actor text := 'Administrador';
begin
  select * into v_closing from public.employee_payroll_closings where id=p_closing_id and public.can_access_store(restaurant_id) for update;
  if not found then raise exception 'Fechamento não encontrado.'; end if;
  if v_closing.status not in ('calculating','review') then raise exception 'Reabra o fechamento antes de lançar ajustes.'; end if;
  if not exists(select 1 from public.employees where id=p_employee_id and restaurant_id=v_closing.restaurant_id) then raise exception 'Colaborador inválido.'; end if;
  if p_adjustment_type not in ('earning','deduction') then raise exception 'Tipo de ajuste inválido.'; end if;
  if coalesce(p_amount,0)<=0 or length(trim(coalesce(p_description,'')))<3 then raise exception 'Informe valor e descrição do ajuste.'; end if;
  if p_operator_id is not null then
    select name into v_actor from public.waiters where id=p_operator_id and user_id=v_closing.restaurant_id and active=true
      and (role='admin' or coalesce((permissions->>'admin')::boolean,false) or coalesce((permissions->>'payroll_manage')::boolean,false));
    if v_actor is null then raise exception 'Operador sem permissão para ajustar o fechamento.'; end if;
  end if;
  insert into public.employee_payroll_adjustments(
    restaurant_id,closing_id,employee_id,adjustment_type,category,amount,description,created_by,created_by_name
  ) values (
    v_closing.restaurant_id,v_closing.id,p_employee_id,p_adjustment_type,trim(p_category),round(p_amount,2),
    trim(p_description),p_operator_id,v_actor
  ) returning id into v_id;
  insert into public.employee_audit_log(
    restaurant_id,employee_id,entity_type,entity_id,action,after_data,actor_waiter_id,actor_name
  ) values (
    v_closing.restaurant_id,p_employee_id,'payroll_adjustment',v_id::text,'created',
    jsonb_build_object('type',p_adjustment_type,'category',p_category,'amount',round(p_amount,2),'description',p_description),
    p_operator_id,v_actor
  );
  return v_id;
end; $$;
revoke all on function public.register_employee_payroll_adjustment(uuid,uuid,text,text,numeric,text,uuid) from public;
grant execute on function public.register_employee_payroll_adjustment(uuid,uuid,text,text,numeric,text,uuid) to authenticated;

create or replace function public.record_employee_advance(
  p_employee_id uuid,
  p_amount numeric,
  p_advance_date date,
  p_payment_method text,
  p_financial_account_id uuid,
  p_note text default null,
  p_operator_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_employee public.employees%rowtype;
  v_account public.financial_accounts%rowtype;
  v_advance_id uuid;
  v_movement_id uuid;
  v_actor_name text := 'Administrador';
begin
  select * into v_employee from public.employees where id = p_employee_id and public.can_access_store(restaurant_id) for update;
  if not found then raise exception 'Colaborador não encontrado ou acesso não autorizado.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor válido.'; end if;
  select * into v_account from public.financial_accounts
    where id = p_financial_account_id and user_id = v_employee.restaurant_id and is_active = true for update;
  if not found then raise exception 'Conta financeira inválida.'; end if;
  if p_operator_id is not null then
    select name into v_actor_name from public.waiters
      where id = p_operator_id and user_id = v_employee.restaurant_id and active = true;
    if v_actor_name is null then raise exception 'Operador inválido.'; end if;
  end if;
  insert into public.financial_movements(
    user_id, financial_account_id, direction, amount, movement_at, description, created_by
  ) values (
    v_employee.restaurant_id, v_account.id, 'out', round(p_amount,2), coalesce(p_advance_date,current_date)::timestamptz,
    concat('Adiantamento: ',v_employee.full_name), auth.uid()
  ) returning id into v_movement_id;
  update public.financial_accounts set current_balance = current_balance - round(p_amount,2), updated_at = now()
    where id = v_account.id;
  insert into public.employee_advances(
    restaurant_id, employee_id, amount, advance_date, payment_method, financial_account_id,
    financial_movement_id, note, created_by
  ) values (
    v_employee.restaurant_id, v_employee.id, round(p_amount,2), coalesce(p_advance_date,current_date), trim(p_payment_method),
    v_account.id, v_movement_id, nullif(trim(coalesce(p_note,'')),''), auth.uid()
  ) returning id into v_advance_id;
  insert into public.employee_audit_log(
    restaurant_id, employee_id, entity_type, entity_id, action, after_data, actor_waiter_id, actor_name
  ) values (
    v_employee.restaurant_id, v_employee.id, 'advance', v_advance_id::text, 'posted',
    jsonb_build_object('amount',round(p_amount,2),'payment_method',p_payment_method,'financial_movement_id',v_movement_id),
    p_operator_id, v_actor_name
  );
  return jsonb_build_object('advance_id',v_advance_id,'movement_id',v_movement_id);
end;
$$;
revoke all on function public.record_employee_advance(uuid,numeric,date,text,uuid,text,uuid) from public;
grant execute on function public.record_employee_advance(uuid,numeric,date,text,uuid,text,uuid) to authenticated;

create or replace function public.generate_employee_payroll_payables(
  p_closing_id uuid,
  p_due_date date,
  p_operator_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_closing public.employee_payroll_closings%rowtype;
  v_item public.employee_payroll_items%rowtype;
  v_employee public.employees%rowtype;
  v_expense_id uuid;
  v_count integer := 0;
  v_actor_name text := 'Administrador';
begin
  select * into v_closing from public.employee_payroll_closings
    where id = p_closing_id and public.can_access_store(restaurant_id) for update;
  if not found then raise exception 'Fechamento não encontrado.'; end if;
  if v_closing.status <> 'approved' then raise exception 'Apenas fechamentos aprovados podem gerar Contas a Pagar.'; end if;
  if p_operator_id is not null then
    select name into v_actor_name from public.waiters where id = p_operator_id and user_id = v_closing.restaurant_id and active = true;
    if v_actor_name is null then raise exception 'Operador inválido.'; end if;
  end if;
  for v_item in select * from public.employee_payroll_items where closing_id = v_closing.id and net_amount > 0 loop
    if v_item.expense_id is null then
      select * into v_employee from public.employees where id = v_item.employee_id;
      insert into public.expenses(
        user_id, description, amount, category, due_date, status, supplier_name,
        payable_origin_type, competence_date, employee_id, payroll_closing_id, created_by, updated_by
      ) values (
        v_closing.restaurant_id, concat('Pagamento funcionário - ',v_employee.full_name,' - ',to_char(v_closing.competence_date,'MM/YYYY')),
        v_item.net_amount, 'Funcionários', p_due_date, 'open', v_employee.full_name,
        'single', v_closing.competence_date, v_employee.id, v_closing.id, auth.uid(), auth.uid()
      ) returning id into v_expense_id;
      update public.employee_payroll_items set expense_id = v_expense_id, status = 'payable_generated', updated_at = now()
        where id = v_item.id;
      v_count := v_count + 1;
    end if;
  end loop;
  update public.employee_payroll_closings
    set status = 'generated_financial', generated_at = now(), updated_at = now() where id = v_closing.id;
  insert into public.employee_audit_log(
    restaurant_id, entity_type, entity_id, action, after_data, actor_waiter_id, actor_name
  ) values (
    v_closing.restaurant_id, 'payroll_closing', v_closing.id::text, 'generated_financial',
    jsonb_build_object('payables_created',v_count,'due_date',p_due_date), p_operator_id, v_actor_name
  );
  return jsonb_build_object('closing_id',v_closing.id,'payables_created',v_count);
end;
$$;
revoke all on function public.generate_employee_payroll_payables(uuid,date,uuid) from public;
grant execute on function public.generate_employee_payroll_payables(uuid,date,uuid) to authenticated;

-- Salva o cadastro principal e sincroniza as projeções legadas numa única transação.
create or replace function public.save_team_employee(
  p_restaurant_id uuid,
  p_employee_id uuid,
  p_profile jsonb,
  p_compensation jsonb,
  p_roles text[],
  p_permissions text[],
  p_apps text[],
  p_pin text default null,
  p_waiter_password text default null,
  p_driver_password text default null,
  p_app_configuration jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_employee_id uuid := coalesce(p_employee_id, gen_random_uuid());
  v_cpf text := nullif(regexp_replace(coalesce(p_profile->>'cpf',''), '\D', '', 'g'), '');
  v_apps text[] := coalesce(p_apps, array[]::text[]);
  v_roles text[] := coalesce(p_roles, array[]::text[]);
  v_permissions text[] := coalesce(p_permissions, array[]::text[]);
  v_permission_json jsonb;
  v_waiter_id uuid;
  v_driver_id uuid;
  v_existing_pin text;
  v_waiter_required boolean;
begin
  if not public.can_access_store(p_restaurant_id) then raise exception 'Acesso não autorizado à loja.'; end if;
  if length(trim(coalesce(p_profile->>'full_name',''))) < 2 then raise exception 'Informe o nome completo.'; end if;

  insert into public.employees(
    id, restaurant_id, full_name, display_name, cpf, phone, email, birth_date, address,
    hire_date, job_title, department, unit_name, employment_status, employment_type,
    weekly_hours, default_day_off, notes, photo_url, created_by, updated_by, updated_at
  ) values (
    v_employee_id, p_restaurant_id, trim(p_profile->>'full_name'), nullif(trim(coalesce(p_profile->>'display_name','')),''),
    v_cpf, nullif(trim(coalesce(p_profile->>'phone','')),''), nullif(lower(trim(coalesce(p_profile->>'email',''))),''),
    nullif(p_profile->>'birth_date','')::date, nullif(trim(coalesce(p_profile->>'address','')),''),
    nullif(p_profile->>'hire_date','')::date, nullif(trim(coalesce(p_profile->>'job_title','')),''),
    nullif(trim(coalesce(p_profile->>'department','')),''), nullif(trim(coalesce(p_profile->>'unit_name','')),''),
    coalesce(nullif(p_profile->>'employment_status',''),'active'), coalesce(nullif(p_profile->>'employment_type',''),'monthly'),
    greatest(0,least(168,coalesce((p_profile->>'weekly_hours')::numeric,44))),
    nullif(p_profile->>'default_day_off','')::smallint, nullif(trim(coalesce(p_profile->>'notes','')),''),
    nullif(trim(coalesce(p_profile->>'photo_url','')),''), auth.uid(), auth.uid(), now()
  ) on conflict (id) do update set
    full_name = excluded.full_name, display_name = excluded.display_name, cpf = excluded.cpf,
    phone = excluded.phone, email = excluded.email, birth_date = excluded.birth_date,
    address = excluded.address, hire_date = excluded.hire_date, job_title = excluded.job_title,
    department = excluded.department, unit_name = excluded.unit_name,
    employment_status = excluded.employment_status, employment_type = excluded.employment_type,
    weekly_hours = excluded.weekly_hours, default_day_off = excluded.default_day_off,
    notes = excluded.notes, photo_url = excluded.photo_url, updated_by = auth.uid(), updated_at = now()
  where employees.restaurant_id = p_restaurant_id;

  insert into public.employee_compensation(
    employee_id, restaurant_id, salary_base, hourly_rate, remuneration_type, default_bonus,
    pix_key, bank_details, updated_by, updated_at
  ) values (
    v_employee_id, p_restaurant_id, greatest(0,coalesce((p_compensation->>'salary_base')::numeric,0)),
    greatest(0,coalesce((p_compensation->>'hourly_rate')::numeric,0)),
    coalesce(nullif(p_compensation->>'remuneration_type',''),'fixed'),
    greatest(0,coalesce((p_compensation->>'default_bonus')::numeric,0)),
    nullif(trim(coalesce(p_compensation->>'pix_key','')),''), coalesce(p_compensation->'bank_details','{}'::jsonb),
    auth.uid(), now()
  ) on conflict (employee_id) do update set
    salary_base = excluded.salary_base, hourly_rate = excluded.hourly_rate,
    remuneration_type = excluded.remuneration_type, default_bonus = excluded.default_bonus,
    pix_key = excluded.pix_key, bank_details = excluded.bank_details, updated_by = auth.uid(), updated_at = now();

  delete from public.employee_roles where employee_id = v_employee_id and not (role_code = any(v_roles));
  insert into public.employee_roles(restaurant_id,employee_id,role_code,created_by)
    select p_restaurant_id,v_employee_id,role_code,auth.uid() from unnest(v_roles) role_code
    on conflict (employee_id,role_code) do nothing;

  delete from public.employee_permissions where employee_id = v_employee_id and not (permission_code = any(v_permissions));
  insert into public.employee_permissions(restaurant_id,employee_id,permission_code,allowed,updated_by)
    select p_restaurant_id,v_employee_id,permission_code,true,auth.uid() from unnest(v_permissions) permission_code
    on conflict (employee_id,permission_code) do update set allowed = true, updated_by = auth.uid(), updated_at = now();

  insert into public.employee_app_access(restaurant_id,employee_id,app_code,enabled,configuration,updated_by)
    select p_restaurant_id,v_employee_id,app_code,app_code = any(v_apps),coalesce(p_app_configuration->app_code,'{}'::jsonb),auth.uid()
    from unnest(array['popsystem','pdv','waiter','driver','time_clock','kds','finance','stock','administration']) app_code
    on conflict (employee_id,app_code) do update set enabled=excluded.enabled, configuration=excluded.configuration,
      updated_by=auth.uid(), updated_at=now();

  select coalesce(jsonb_object_agg(permission_code,true),'{}'::jsonb) into v_permission_json
    from unnest(v_permissions) permission_code;
  v_permission_json := v_permission_json || jsonb_build_object(
    'waiter_app','waiter' = any(v_apps), 'pos_access','pdv' = any(v_apps), 'kds_access','kds' = any(v_apps),
    'financial_view','finance' = any(v_apps), 'stock_manage','stock' = any(v_apps),
    'admin','administration' = any(v_apps)
  );
  v_waiter_required := v_apps && array['popsystem','pdv','waiter','time_clock','kds','finance','stock','administration'];
  select id,pin into v_waiter_id,v_existing_pin from public.waiters where employee_id=v_employee_id limit 1;
  if v_waiter_required then
    if coalesce(nullif(trim(p_pin),''),v_existing_pin) is null then raise exception 'Informe um PIN para os acessos operacionais.'; end if;
    if v_waiter_id is null then
      insert into public.waiters(id,user_id,name,pin,active,role,permissions,email,password,cpf,employment_type,
        salary_amount,hourly_rate,weekly_hours,hire_date,job_title,employee_id)
      values(v_employee_id,p_restaurant_id,trim(p_profile->>'full_name'),trim(p_pin),
        coalesce(p_profile->>'employment_status','active')='active',
        case when 'administrator'=any(v_roles) then 'admin' else 'cashier' end,v_permission_json,
        nullif(lower(trim(coalesce(p_profile->>'email',''))),''),nullif(p_waiter_password,''),v_cpf,
        case when coalesce(p_profile->>'employment_type','monthly') in('hourly','daily','weekly','monthly','clt','freelance') then coalesce(p_profile->>'employment_type','monthly') else 'freelance' end,greatest(0,coalesce((p_compensation->>'salary_base')::numeric,0)),
        greatest(0,coalesce((p_compensation->>'hourly_rate')::numeric,0)),coalesce((p_profile->>'weekly_hours')::numeric,44),
        nullif(p_profile->>'hire_date','')::date,nullif(trim(coalesce(p_profile->>'job_title','')),''),v_employee_id)
      returning id into v_waiter_id;
    else
      update public.waiters set name=trim(p_profile->>'full_name'),pin=coalesce(nullif(trim(p_pin),''),pin),
        active=coalesce(p_profile->>'employment_status','active')='active',
        role=case when 'administrator'=any(v_roles) then 'admin' else 'cashier' end,permissions=v_permission_json,
        email=nullif(lower(trim(coalesce(p_profile->>'email',''))),''),password=coalesce(nullif(p_waiter_password,''),password),cpf=v_cpf,
        employment_type=case when coalesce(p_profile->>'employment_type','monthly') in('hourly','daily','weekly','monthly','clt','freelance') then coalesce(p_profile->>'employment_type','monthly') else 'freelance' end,
        salary_amount=greatest(0,coalesce((p_compensation->>'salary_base')::numeric,0)),
        hourly_rate=greatest(0,coalesce((p_compensation->>'hourly_rate')::numeric,0)),
        weekly_hours=coalesce((p_profile->>'weekly_hours')::numeric,44),hire_date=nullif(p_profile->>'hire_date','')::date,
        job_title=nullif(trim(coalesce(p_profile->>'job_title','')),'') where id=v_waiter_id;
    end if;
  elsif v_waiter_id is not null then
    update public.waiters set active=false where id=v_waiter_id;
  end if;

  select id into v_driver_id from public.delivery_personnel where employee_id=v_employee_id limit 1;
  if 'driver'=any(v_apps) then
    if nullif(trim(coalesce(p_profile->>'phone','')),'') is null then raise exception 'Informe o telefone para o App Motoboy.'; end if;
    if v_driver_id is null then
      insert into public.delivery_personnel(id,user_id,name,phone,vehicle_type,vehicle_plate,status,app_enabled,cpf,app_password_hash,employee_id)
      values(v_employee_id,p_restaurant_id,trim(p_profile->>'full_name'),trim(p_profile->>'phone'),
        coalesce(nullif(p_app_configuration#>>'{driver,vehicle_type}',''),'Moto'),nullif(p_app_configuration#>>'{driver,vehicle_plate}',''),
        'available',true,v_cpf,case when nullif(p_driver_password,'') is null then null else crypt(p_driver_password,gen_salt('bf')) end,v_employee_id)
      returning id into v_driver_id;
    else
      update public.delivery_personnel set name=trim(p_profile->>'full_name'),phone=trim(p_profile->>'phone'),
        vehicle_type=coalesce(nullif(p_app_configuration#>>'{driver,vehicle_type}',''),vehicle_type),
        vehicle_plate=coalesce(nullif(p_app_configuration#>>'{driver,vehicle_plate}',''),vehicle_plate),app_enabled=true,cpf=v_cpf,
        app_password_hash=case when nullif(p_driver_password,'') is null then app_password_hash else crypt(p_driver_password,gen_salt('bf')) end,
        updated_at=now() where id=v_driver_id;
    end if;
  elsif v_driver_id is not null then
    update public.delivery_personnel set app_enabled=false,status='offline',updated_at=now() where id=v_driver_id;
  end if;

  insert into public.employee_audit_log(restaurant_id,employee_id,entity_type,entity_id,action,after_data,actor_name)
  values(p_restaurant_id,v_employee_id,'employee',v_employee_id::text,case when p_employee_id is null then 'created' else 'updated' end,
    jsonb_build_object('roles',v_roles,'apps',v_apps,'permissions',v_permissions),'Usuário autenticado');
  return v_employee_id;
end;
$$;
revoke all on function public.save_team_employee(uuid,uuid,jsonb,jsonb,text[],text[],text[],text,text,text,jsonb) from public;
grant execute on function public.save_team_employee(uuid,uuid,jsonb,jsonb,text[],text[],text[],text,text,text,jsonb) to authenticated;

create or replace function public.save_employee_payroll_preview(
  p_restaurant_id uuid, p_competence_date date, p_unit_name text, p_items jsonb, p_snapshot jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_closing public.employee_payroll_closings%rowtype; v_item jsonb;
begin
  if not public.can_access_store(p_restaurant_id) then raise exception 'Acesso não autorizado à loja.'; end if;
  select * into v_closing from public.employee_payroll_closings
    where restaurant_id=p_restaurant_id and competence_date=p_competence_date and unit_name is not distinct from nullif(trim(coalesce(p_unit_name,'')),'') for update;
  if found and v_closing.status not in ('calculating','review') then
    raise exception 'Este período já foi fechado. Reabra o fechamento antes de recalcular.';
  end if;
  if not found then
    insert into public.employee_payroll_closings(restaurant_id,competence_date,unit_name,status,calculation_snapshot)
    values(p_restaurant_id,p_competence_date,nullif(trim(coalesce(p_unit_name,'')),''),'review',coalesce(p_snapshot,'{}'::jsonb)) returning * into v_closing;
  else
    update public.employee_payroll_closings set status='review',calculation_snapshot=coalesce(p_snapshot,'{}'::jsonb),updated_at=now()
      where id=v_closing.id returning * into v_closing;
    delete from public.employee_payroll_items where closing_id=v_closing.id;
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.employee_payroll_items(
      closing_id,restaurant_id,employee_id,base_salary,expected_minutes,worked_minutes,overtime_minutes,late_minutes,
      early_leave_minutes,absence_days,days_off,worked_days,commissions,bonuses,advances,other_earnings,
      absence_deductions,late_deductions,other_deductions,total_earnings,total_deductions,net_amount,calculation_details
    ) values(
      v_closing.id,p_restaurant_id,(v_item->>'employee_id')::uuid,coalesce((v_item->>'base_salary')::numeric,0),
      coalesce((v_item->>'expected_minutes')::integer,0),coalesce((v_item->>'worked_minutes')::integer,0),
      coalesce((v_item->>'overtime_minutes')::integer,0),coalesce((v_item->>'late_minutes')::integer,0),
      coalesce((v_item->>'early_leave_minutes')::integer,0),coalesce((v_item->>'absence_days')::numeric,0),
      coalesce((v_item->>'days_off')::integer,0),coalesce((v_item->>'worked_days')::integer,0),
      coalesce((v_item->>'commissions')::numeric,0),coalesce((v_item->>'bonuses')::numeric,0),
      coalesce((v_item->>'advances')::numeric,0),coalesce((v_item->>'other_earnings')::numeric,0),
      coalesce((v_item->>'absence_deductions')::numeric,0),coalesce((v_item->>'late_deductions')::numeric,0),
      coalesce((v_item->>'other_deductions')::numeric,0),coalesce((v_item->>'total_earnings')::numeric,0),
      coalesce((v_item->>'total_deductions')::numeric,0),coalesce((v_item->>'net_amount')::numeric,0),coalesce(v_item->'calculation_details','{}'::jsonb)
    );
  end loop;
  update public.employee_payroll_closings set
    total_earnings=(select coalesce(sum(total_earnings),0) from public.employee_payroll_items where closing_id=v_closing.id),
    total_deductions=(select coalesce(sum(total_deductions),0) from public.employee_payroll_items where closing_id=v_closing.id),
    total_net=(select coalesce(sum(net_amount),0) from public.employee_payroll_items where closing_id=v_closing.id),updated_at=now()
    where id=v_closing.id;
  update public.employee_commissions set status='included'
    where restaurant_id=p_restaurant_id and status='pending'
      and date_trunc('month',competence_date)=date_trunc('month',p_competence_date);
  update public.employee_advances set status='included'
    where restaurant_id=p_restaurant_id and status='posted'
      and date_trunc('month',advance_date)=date_trunc('month',p_competence_date);
  return v_closing.id;
end; $$;
revoke all on function public.save_employee_payroll_preview(uuid,date,text,jsonb,jsonb) from public;
grant execute on function public.save_employee_payroll_preview(uuid,date,text,jsonb,jsonb) to authenticated;

create or replace function public.set_employee_payroll_closing_status(
  p_closing_id uuid, p_status text, p_operator_id uuid default null, p_reason text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare v_closing public.employee_payroll_closings%rowtype; v_actor text := 'Administrador';
begin
  select * into v_closing from public.employee_payroll_closings where id=p_closing_id and public.can_access_store(restaurant_id) for update;
  if not found then raise exception 'Fechamento não encontrado.'; end if;
  if p_operator_id is not null then select name into v_actor from public.waiters where id=p_operator_id and user_id=v_closing.restaurant_id and active=true; end if;
  if p_status='approved' then
    if v_closing.status not in ('calculating','review') then raise exception 'O fechamento não está disponível para aprovação.'; end if;
    update public.employee_payroll_closings set status='approved',approved_at=now(),approved_by=p_operator_id,approved_by_name=v_actor,updated_at=now() where id=p_closing_id;
  elsif p_status='review' then
    if v_closing.status <> 'approved' then raise exception 'Após gerar o financeiro, cancele as obrigações antes de reabrir.'; end if;
    if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Informe o motivo da reabertura.'; end if;
    update public.employee_payroll_closings set status='review',reopened_at=now(),reopened_by=p_operator_id,reopened_by_name=v_actor,reopen_reason=trim(p_reason),updated_at=now() where id=p_closing_id;
  else raise exception 'Status inválido.';
  end if;
  insert into public.employee_audit_log(restaurant_id,entity_type,entity_id,action,reason,actor_waiter_id,actor_name)
    values(v_closing.restaurant_id,'payroll_closing',p_closing_id::text,p_status,p_reason,p_operator_id,v_actor);
end; $$;
revoke all on function public.set_employee_payroll_closing_status(uuid,text,uuid,text) from public;
grant execute on function public.set_employee_payroll_closing_status(uuid,text,uuid,text) to authenticated;

create or replace function public.correct_employee_time_entry(
  p_event_id uuid, p_occurred_at timestamptz, p_reason text, p_operator_id uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_original public.employee_time_clock_events%rowtype; v_new_id uuid; v_actor text := 'Administrador';
begin
  select * into v_original from public.employee_time_clock_events where id=p_event_id and public.can_access_store(user_id) for update;
  if not found then raise exception 'Registro de ponto não encontrado.'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Informe o motivo da correção.'; end if;
  if p_operator_id is not null then
    select name into v_actor from public.waiters where id=p_operator_id and user_id=v_original.user_id and active=true;
    if v_actor is null then raise exception 'Operador inválido.'; end if;
  end if;
  insert into public.employee_time_clock_events(
    user_id,waiter_id,employee_id,event_type,status,occurred_at,latitude,longitude,accuracy_meters,distance_meters,
    within_geofence,device_fingerprint,device_trusted,face_provider,face_status,face_score,face_reference_id,
    selfie_url,review_reason,reviewed_by,reviewed_at,metadata
  ) values(
    v_original.user_id,v_original.waiter_id,v_original.employee_id,v_original.event_type,'approved',p_occurred_at,
    v_original.latitude,v_original.longitude,v_original.accuracy_meters,v_original.distance_meters,v_original.within_geofence,
    v_original.device_fingerprint,v_original.device_trusted,v_original.face_provider,v_original.face_status,v_original.face_score,
    v_original.face_reference_id,v_original.selfie_url,concat('Correção: ',trim(p_reason)),p_operator_id,now(),
    coalesce(v_original.metadata,'{}'::jsonb)||jsonb_build_object('corrected_from',v_original.id)
  ) returning id into v_new_id;
  update public.employee_time_clock_events set status='rejected',review_reason=concat('Substituído por correção ',v_new_id,': ',trim(p_reason)),reviewed_by=p_operator_id,reviewed_at=now() where id=v_original.id;
  insert into public.employee_time_entry_corrections(restaurant_id,employee_id,original_event_id,corrected_event_id,original_snapshot,corrected_snapshot,reason,corrected_by,corrected_by_name)
  select v_original.user_id,v_original.employee_id,v_original.id,v_new_id,to_jsonb(v_original),to_jsonb(corrected),trim(p_reason),p_operator_id,v_actor
    from public.employee_time_clock_events corrected where corrected.id=v_new_id;
  insert into public.employee_audit_log(restaurant_id,employee_id,entity_type,entity_id,action,before_data,after_data,reason,actor_waiter_id,actor_name)
  select v_original.user_id,v_original.employee_id,'time_entry',v_original.id::text,'corrected',to_jsonb(v_original),to_jsonb(corrected),trim(p_reason),p_operator_id,v_actor
    from public.employee_time_clock_events corrected where corrected.id=v_new_id;
  return v_new_id;
end; $$;
revoke all on function public.correct_employee_time_entry(uuid,timestamptz,text,uuid) from public;
grant execute on function public.correct_employee_time_entry(uuid,timestamptz,text,uuid) to authenticated;

create or replace function public.prevent_closed_period_time_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_restaurant_id uuid; v_employee_id uuid; v_occurred_at timestamptz;
begin
  if tg_op='DELETE' then
    v_restaurant_id:=old.user_id; v_employee_id:=old.employee_id; v_occurred_at:=old.occurred_at;
  else
    v_restaurant_id:=new.user_id; v_employee_id:=new.employee_id; v_occurred_at:=new.occurred_at;
  end if;
  if exists(
    select 1 from public.employee_payroll_closings closing
    where closing.restaurant_id=v_restaurant_id and closing.status in ('approved','generated_financial','paid')
      and date_trunc('month',closing.competence_date)=date_trunc('month',v_occurred_at)
      and (closing.unit_name is null or exists(
        select 1 from public.employees employee where employee.id=v_employee_id and employee.unit_name=closing.unit_name
      ))
  ) then
    raise exception 'Este período já foi fechado. Reabra o fechamento antes de alterar o ponto.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists time_clock_events_block_closed_period on public.employee_time_clock_events;
create trigger time_clock_events_block_closed_period before insert or update or delete on public.employee_time_clock_events
for each row execute function public.prevent_closed_period_time_change();

create or replace function public.refresh_employee_team_alerts(p_restaurant_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer := 0; v_added integer := 0; v_settings public.employee_payroll_settings%rowtype;
begin
  if not public.can_access_store(p_restaurant_id) then raise exception 'Acesso não autorizado à loja.'; end if;
  select * into v_settings from public.employee_payroll_settings where restaurant_id=p_restaurant_id;
  if not found then
    v_settings.late_tolerance_minutes := 5;
    v_settings.alert_overtime_minutes := 120;
    v_settings.alert_absence_count := 3;
  end if;
  delete from public.employee_alerts where restaurant_id=p_restaurant_id and status='open' and alert_type in
    ('missing_entry','missing_exit','open_break','inconsistent_point','overtime_limit','many_absences','pending_closing','high_advance');

  insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,employee.id,'missing_entry','warning','Entrada não registrada',
    concat(employee.full_name,' possui jornada hoje e ainda não registrou entrada.'),current_date
  from public.employees employee join public.employee_work_schedules schedule on schedule.employee_id=employee.id
  where employee.restaurant_id=p_restaurant_id and employee.employment_status='active'
    and schedule.weekday=extract(dow from current_date)::integer and schedule.is_day_off=false
    and current_date between schedule.effective_from and coalesce(schedule.effective_until,current_date)
    and localtime > schedule.first_start + make_interval(mins=>v_settings.late_tolerance_minutes)
    and not exists(select 1 from public.employee_time_clock_events event where event.employee_id=employee.id and event.status<>'rejected' and event.event_type='clock_in' and event.occurred_at::date=current_date)
    and not exists(select 1 from public.employee_time_clock_occurrences occurrence where occurrence.employee_id=employee.id and occurrence.status<>'rejected' and current_date between occurrence.start_date and occurrence.end_date and occurrence.affects_expected_hours=true);
  get diagnostics v_count=row_count;

  with last_events as (
    select distinct on(event.employee_id) event.employee_id,event.event_type from public.employee_time_clock_events event
    where event.user_id=p_restaurant_id and event.status<>'rejected' and event.occurred_at::date=current_date-1
    order by event.employee_id,event.occurred_at desc
  ) insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,last.employee_id,'missing_exit','critical','Saída não registrada',
    concat(employee.full_name,' ficou com o ponto de ontem incompleto.'),current_date-1
  from last_events last join public.employees employee on employee.id=last.employee_id where last.event_type<>'clock_out';
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  with daily as (
    select event.employee_id,event.occurred_at::date as work_date,count(*) as event_count,
      count(*) filter(where event.event_type='clock_in') as entries,
      count(*) filter(where event.event_type='clock_out') as exits
    from public.employee_time_clock_events event
    where event.user_id=p_restaurant_id and event.status<>'rejected'
      and event.occurred_at::date between current_date-31 and current_date
    group by event.employee_id,event.occurred_at::date
  ) insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,daily.employee_id,'inconsistent_point','warning','Ponto inconsistente',
    concat(employee.full_name,' possui uma sequência incompleta ou duplicada no dia ',to_char(daily.work_date,'DD/MM'),'.'),daily.work_date
  from daily join public.employees employee on employee.id=daily.employee_id
  where daily.entries<>1 or daily.exits<>1 or daily.event_count not in (2,4);
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  with last_events as (
    select distinct on(event.employee_id) event.employee_id,event.event_type from public.employee_time_clock_events event
    where event.user_id=p_restaurant_id and event.status<>'rejected' and event.occurred_at::date=current_date
    order by event.employee_id,event.occurred_at desc
  ) insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,last.employee_id,'open_break','warning','Intervalo não finalizado',
    concat(employee.full_name,' iniciou um intervalo sem retorno.'),current_date
  from last_events last join public.employees employee on employee.id=last.employee_id where last.event_type='break_start';
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,item.employee_id,'overtime_limit','warning','Horas extras acima do limite',
    concat(employee.full_name,' acumulou ',round(item.overtime_minutes/60.0,1),'h extras na prévia.'),closing.competence_date
  from public.employee_payroll_items item join public.employee_payroll_closings closing on closing.id=item.closing_id
  join public.employees employee on employee.id=item.employee_id
  where closing.restaurant_id=p_restaurant_id and date_trunc('month',closing.competence_date)=date_trunc('month',current_date)
    and item.overtime_minutes>v_settings.alert_overtime_minutes;
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,item.employee_id,'many_absences','warning','Muitas faltas no mês',
    concat(employee.full_name,' possui ',item.absence_days,' falta(s) na prévia atual.'),closing.competence_date
  from public.employee_payroll_items item join public.employee_payroll_closings closing on closing.id=item.closing_id
  join public.employees employee on employee.id=item.employee_id
  where closing.restaurant_id=p_restaurant_id and date_trunc('month',closing.competence_date)=date_trunc('month',current_date)
    and item.absence_days>=v_settings.alert_absence_count;
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  insert into public.employee_alerts(restaurant_id,employee_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,advance.employee_id,'high_advance','warning','Adiantamento elevado',
    concat(employee.full_name,' recebeu ',to_char(sum(advance.amount),'FM999G999G990D00'),' em adiantamentos neste mês.'),
    date_trunc('month',current_date)::date
  from public.employee_advances advance join public.employees employee on employee.id=advance.employee_id
  left join public.employee_compensation compensation on compensation.employee_id=advance.employee_id
  where advance.restaurant_id=p_restaurant_id and advance.status<>'reversed'
    and date_trunc('month',advance.advance_date)=date_trunc('month',current_date)
  group by advance.employee_id,employee.full_name,compensation.salary_base
  having sum(advance.amount)>greatest(coalesce(compensation.salary_base,0)*0.5,500);
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  insert into public.employee_alerts(restaurant_id,alert_type,severity,title,description,reference_date)
  select p_restaurant_id,'pending_closing','info','Fechamento pendente',
    concat('A competência ',to_char(closing.competence_date,'MM/YYYY'),' ainda está em revisão.'),closing.competence_date
  from public.employee_payroll_closings closing where closing.restaurant_id=p_restaurant_id and closing.status in('calculating','review');
  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;
  return v_count;
end; $$;
revoke all on function public.refresh_employee_team_alerts(uuid) from public;
grant execute on function public.refresh_employee_team_alerts(uuid) to authenticated;

create or replace function public.sync_employee_payroll_payment_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_closing_id uuid;
begin
  if new.payroll_closing_id is null then return new; end if;
  update public.employee_payroll_items set status=case when new.status='paid' then 'paid' else 'payable_generated' end,updated_at=now()
    where expense_id=new.id returning closing_id into v_closing_id;
  if v_closing_id is not null then
    if new.status='paid' then
      update public.employee_commissions commission set status='paid'
        from public.employee_payroll_closings closing
        where closing.id=v_closing_id and commission.restaurant_id=closing.restaurant_id
          and commission.employee_id=new.employee_id and commission.status='included'
          and date_trunc('month',commission.competence_date)=date_trunc('month',closing.competence_date);
      update public.employee_advances advance set status='included'
        from public.employee_payroll_closings closing
        where closing.id=v_closing_id and advance.restaurant_id=closing.restaurant_id
          and advance.employee_id=new.employee_id and advance.status='included'
          and date_trunc('month',advance.advance_date)=date_trunc('month',closing.competence_date);
    end if;
    update public.employee_payroll_closings set status=case
      when not exists(select 1 from public.employee_payroll_items where closing_id=v_closing_id and status<>'paid') then 'paid'
      else 'generated_financial' end,updated_at=now() where id=v_closing_id;
  end if;
  return new;
end; $$;
drop trigger if exists expenses_sync_employee_payroll on public.expenses;
create trigger expenses_sync_employee_payroll after update of status on public.expenses
for each row when (new.payroll_closing_id is not null and old.status is distinct from new.status)
execute function public.sync_employee_payroll_payment_status();

notify pgrst, 'reload schema';
