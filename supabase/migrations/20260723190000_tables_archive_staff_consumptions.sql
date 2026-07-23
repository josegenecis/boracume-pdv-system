-- Mesas não devem ser apagadas fisicamente depois de terem movimentação.
-- O arquivamento preserva todas as chaves estrangeiras e a trilha de auditoria.
alter table public.tables
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists idx_tables_user_active
  on public.tables(user_id, table_number)
  where archived_at is null;

create table if not exists public.staff_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_name text not null,
  source_table_id uuid references public.tables(id) on delete set null,
  source_account_id uuid references public.table_accounts(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  due_date date,
  notes text,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  payment_method text,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_consumptions_user_status
  on public.staff_consumptions(user_id, status, created_at desc);

create unique index if not exists idx_staff_consumptions_open_account
  on public.staff_consumptions(source_account_id)
  where source_account_id is not null and status = 'open';

alter table public.staff_consumptions enable row level security;

drop policy if exists "Users manage own staff consumptions" on public.staff_consumptions;
create policy "Users manage own staff consumptions"
  on public.staff_consumptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.defer_table_account_to_staff(
  p_account_id uuid,
  p_employee_name text,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account public.table_accounts%rowtype;
  v_receivable_id uuid;
begin
  if nullif(trim(p_employee_name), '') is null then
    raise exception 'Informe o nome do funcionário.';
  end if;

  select *
    into v_account
    from public.table_accounts
   where id = p_account_id
     and user_id = auth.uid()
     and status in ('open', 'payment_pending')
   for update;

  if not found then
    raise exception 'Conta da mesa não encontrada ou já encerrada.';
  end if;

  insert into public.staff_consumptions (
    user_id,
    employee_name,
    source_table_id,
    source_account_id,
    items,
    amount,
    due_date,
    notes,
    created_by
  ) values (
    v_account.user_id,
    trim(p_employee_name),
    v_account.table_id,
    v_account.id,
    coalesce(v_account.items, '[]'::jsonb),
    coalesce(v_account.total, 0),
    p_due_date,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_receivable_id;

  update public.table_accounts
     set status = 'employee_receivable',
         table_id = null,
         closed_at = now(),
         updated_at = now()
   where id = v_account.id;

  update public.tables
     set status = 'available',
         updated_at = now()
   where id = v_account.table_id
     and user_id = auth.uid();

  return v_receivable_id;
end;
$$;

grant execute on function public.defer_table_account_to_staff(uuid, text, date, text) to authenticated;

create or replace function public.settle_staff_consumption(
  p_receivable_id uuid,
  p_payment_method text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.staff_consumptions
     set status = 'paid',
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         paid_at = now(),
         paid_by = auth.uid(),
         updated_at = now()
   where id = p_receivable_id
     and user_id = auth.uid()
     and status = 'open';

  if not found then
    raise exception 'Consumo pendente não encontrado ou já baixado.';
  end if;
end;
$$;

grant execute on function public.settle_staff_consumption(uuid, text) to authenticated;
