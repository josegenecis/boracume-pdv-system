-- Campos para transformar Equipe/Garcons em cadastro operacional de funcionarios.
alter table public.waiters
  add column if not exists employment_type text not null default 'monthly',
  add column if not exists salary_amount numeric(12,2) not null default 0,
  add column if not exists hourly_rate numeric(12,2) not null default 0,
  add column if not exists weekly_hours numeric(8,2) not null default 44,
  add column if not exists hire_date date,
  add column if not exists job_title text;

alter table public.waiters
  drop constraint if exists waiters_employment_type_check;

alter table public.waiters
  add constraint waiters_employment_type_check
  check (employment_type in ('hourly', 'daily', 'weekly', 'monthly', 'clt', 'freelance'));

-- Campos para o painel inicial enxergar contas a vencer e para o financeiro evoluir
-- de simples despesa para controle de contas.
alter table public.expenses
  add column if not exists due_date date,
  add column if not exists paid_at timestamptz,
  add column if not exists supplier_name text,
  add column if not exists document_number text,
  add column if not exists status text not null default 'pending';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'expense_date'
  ) then
    execute 'update public.expenses set due_date = coalesce(due_date, expense_date) where due_date is null';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'date'
  ) then
    execute 'update public.expenses set due_date = coalesce(due_date, date::date) where due_date is null';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'created_at'
  ) then
    execute 'update public.expenses set due_date = coalesce(due_date, created_at::date) where due_date is null';
  end if;
end $$;

create index if not exists idx_expenses_user_due_date
  on public.expenses(user_id, due_date);

create index if not exists idx_waiters_user_employment_type
  on public.waiters(user_id, employment_type);
