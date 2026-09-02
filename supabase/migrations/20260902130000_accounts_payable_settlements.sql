-- Contas a pagar profissionais: obrigação 1:N baixas 1:1 movimentações.
-- Todas as operações críticas são transacionais e preservam auditoria.

alter table public.expenses
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_by_waiter_id uuid references public.waiters(id) on delete set null,
  add column if not exists cancelled_by_name text,
  add column if not exists payable_group_id uuid,
  add column if not exists payable_origin_type text not null default 'single',
  add column if not exists installment_number integer,
  add column if not exists installment_count integer,
  add column if not exists competence_date date;

update public.expenses
set status = case
  when is_active = false then coalesce(nullif(status, ''), 'cancelled')
  when lower(coalesce(status, '')) in ('paid', 'paga', 'pago') or paid_at is not null then 'paid'
  when lower(coalesce(status, '')) in ('partial', 'partially_paid', 'parcialmente paga', 'parcialmente_pago') then 'partially_paid'
  when due_date is not null and due_date < current_date then 'overdue'
  else 'open'
end,
paid_amount = case
  when lower(coalesce(status, '')) in ('paid', 'paga', 'pago') or paid_at is not null then amount
  else greatest(coalesce(paid_amount, 0), 0)
end;

alter table public.expenses
  drop constraint if exists expenses_payable_origin_type_check;
alter table public.expenses
  add constraint expenses_payable_origin_type_check
  check (payable_origin_type in ('single', 'installment', 'recurring', 'purchase_invoice'));

alter table public.expenses
  drop constraint if exists expenses_installment_sequence_check;
alter table public.expenses
  add constraint expenses_installment_sequence_check check (
    (installment_number is null and installment_count is null)
    or (installment_number between 1 and installment_count and installment_count between 1 and 120)
  );

create index if not exists expenses_payable_status_due_idx
  on public.expenses(user_id, status, due_date);
create index if not exists expenses_payable_group_idx
  on public.expenses(user_id, payable_group_id, installment_number);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'bank'
    check (account_type in ('cash', 'bank', 'digital_wallet', 'other')),
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_accounts_user_name_uidx
  on public.financial_accounts(user_id, lower(name));
create index if not exists financial_accounts_user_active_idx
  on public.financial_accounts(user_id, is_active, name);

alter table public.financial_accounts enable row level security;
drop policy if exists "Users manage own financial accounts" on public.financial_accounts;
create policy "Users manage own financial accounts"
  on public.financial_accounts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
revoke all on public.financial_accounts from authenticated;
grant select on public.financial_accounts to authenticated;

create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  paid_at timestamptz not null default now(),
  payment_method text not null,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  note text,
  proof_path text,
  proof_name text,
  proof_mime_type text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  responsible_waiter_id uuid references public.waiters(id) on delete set null,
  responsible_name text not null,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reversed_at timestamptz,
  reversal_reason text,
  reversed_by_user_id uuid references auth.users(id) on delete set null,
  reversed_by_waiter_id uuid references public.waiters(id) on delete set null,
  reversed_by_name text,
  operation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (user_id, operation_id)
);

create index if not exists expense_payments_expense_date_idx
  on public.expense_payments(expense_id, payment_date, created_at);
create index if not exists expense_payments_user_status_idx
  on public.expense_payments(user_id, status, paid_at desc);

alter table public.expense_payments enable row level security;
drop policy if exists "Users view own expense payments" on public.expense_payments;
create policy "Users view own expense payments"
  on public.expense_payments for select to authenticated
  using (auth.uid() = user_id);
grant select on public.expense_payments to authenticated;

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  expense_id uuid references public.expenses(id) on delete restrict,
  expense_payment_id uuid references public.expense_payments(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(12,2) not null check (amount > 0),
  movement_at timestamptz not null default now(),
  description text not null,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reverses_movement_id uuid references public.financial_movements(id) on delete restrict,
  operation_id uuid not null default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, operation_id)
);

create unique index if not exists financial_movements_payment_posted_uidx
  on public.financial_movements(expense_payment_id)
  where expense_payment_id is not null and reverses_movement_id is null;
create index if not exists financial_movements_account_date_idx
  on public.financial_movements(financial_account_id, movement_at desc);

alter table public.financial_movements enable row level security;
drop policy if exists "Users view own financial movements" on public.financial_movements;
create policy "Users view own financial movements"
  on public.financial_movements for select to authenticated
  using (auth.uid() = user_id);
grant select on public.financial_movements to authenticated;

alter table public.cash_movements
  add column if not exists expense_payment_id uuid references public.expense_payments(id) on delete restrict,
  add column if not exists financial_movement_id uuid references public.financial_movements(id) on delete restrict;

create index if not exists cash_movements_expense_payment_idx
  on public.cash_movements(expense_payment_id)
  where expense_payment_id is not null;

create or replace function public.ensure_default_financial_accounts()
returns setof public.financial_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then
    raise exception 'Sessão expirada. Entre novamente no sistema.';
  end if;

  insert into public.financial_accounts(user_id, name, account_type)
  values (v_owner_id, 'Caixa', 'cash'), (v_owner_id, 'Banco', 'bank')
  on conflict (user_id, lower(name)) do nothing;

  return query
    select account.* from public.financial_accounts account
    where account.user_id = v_owner_id and account.is_active = true
    order by case account.account_type when 'cash' then 0 when 'bank' then 1 else 2 end, account.name;
end;
$$;
revoke all on function public.ensure_default_financial_accounts() from public;
grant execute on function public.ensure_default_financial_accounts() to authenticated;

create or replace function public.refresh_my_payable_statuses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.expenses
  set status = case when due_date < current_date then 'overdue' else 'open' end
  where user_id = auth.uid()
    and is_active is distinct from false
    and coalesce(paid_amount, 0) <= 0
    and status in ('open', 'overdue', 'pending');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.refresh_my_payable_statuses() from public;
grant execute on function public.refresh_my_payable_statuses() to authenticated;

create or replace function public.record_expense_payment(
  p_expense_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_financial_account_id uuid,
  p_note text default null,
  p_proof_path text default null,
  p_proof_name text default null,
  p_proof_mime_type text default null,
  p_operator_id uuid default null,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_account public.financial_accounts%rowtype;
  v_operator public.waiters%rowtype;
  v_operator_name text := 'Administrador';
  v_payment_id uuid;
  v_movement_id uuid;
  v_session_id uuid;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_status text;
begin
  if v_owner_id is null then raise exception 'Sessão expirada. Entre novamente no sistema.'; end if;
  if p_amount is null or round(p_amount, 2) <= 0 then raise exception 'Informe um valor de pagamento válido.'; end if;
  if p_payment_date is null then raise exception 'Informe a data do pagamento.'; end if;
  if nullif(trim(coalesce(p_payment_method, '')), '') is null then raise exception 'Informe a forma de pagamento.'; end if;

  if p_operator_id is not null then
    select * into v_operator from public.waiters
    where id = p_operator_id and user_id = v_owner_id and active = true;
    if not found then raise exception 'Operador inválido ou inativo.'; end if;
    if not (v_operator.role = 'admin'
      or coalesce((v_operator.permissions->>'admin')::boolean, false)
      or coalesce((v_operator.permissions->>'expenses_manage')::boolean, false)
      or coalesce((v_operator.permissions->>'expense_payments_manage')::boolean, false)) then
      raise exception 'Este operador não tem permissão para baixar contas a pagar.';
    end if;
    v_operator_name := v_operator.name;
  end if;

  select * into v_expense from public.expenses
  where id = p_expense_id and user_id = v_owner_id for update;
  if not found then raise exception 'Conta a pagar não encontrada.'; end if;
  if v_expense.is_active = false or v_expense.status = 'cancelled' then raise exception 'Uma conta cancelada não pode receber pagamentos.'; end if;

  select * into v_account from public.financial_accounts
  where id = p_financial_account_id and user_id = v_owner_id and is_active = true for update;
  if not found then raise exception 'Selecione uma conta financeira ativa.'; end if;

  select coalesce(sum(payment.amount) filter (where payment.status = 'posted'), 0)
    into v_paid from public.expense_payments payment where payment.expense_id = v_expense.id;
  v_paid := greatest(v_paid, coalesce(v_expense.paid_amount, 0));
  v_remaining := round(v_expense.amount - v_paid, 2);
  if v_remaining <= 0 then raise exception 'Esta conta já está totalmente paga.'; end if;
  if round(p_amount, 2) > v_remaining then
    raise exception 'O pagamento não pode ultrapassar o saldo restante de R$ %.', replace(to_char(v_remaining, 'FM999999990D00'), '.', ',');
  end if;

  insert into public.expense_payments(
    user_id, expense_id, amount, payment_date, payment_method, financial_account_id,
    note, proof_path, proof_name, proof_mime_type, responsible_user_id,
    responsible_waiter_id, responsible_name, operation_id
  ) values (
    v_owner_id, v_expense.id, round(p_amount, 2), p_payment_date, trim(p_payment_method), v_account.id,
    nullif(trim(coalesce(p_note, '')), ''), nullif(trim(coalesce(p_proof_path, '')), ''),
    nullif(trim(coalesce(p_proof_name, '')), ''), nullif(trim(coalesce(p_proof_mime_type, '')), ''),
    v_owner_id, p_operator_id, v_operator_name, p_operation_id
  ) returning id into v_payment_id;

  insert into public.financial_movements(
    user_id, financial_account_id, expense_id, expense_payment_id, direction,
    amount, movement_at, description, operation_id, created_by
  ) values (
    v_owner_id, v_account.id, v_expense.id, v_payment_id, 'out', round(p_amount, 2),
    now(), concat('Pagamento: ', v_expense.description), p_operation_id, v_owner_id
  ) returning id into v_movement_id;

  update public.financial_accounts
  set current_balance = current_balance - round(p_amount, 2), updated_at = now()
  where id = v_account.id;

  if v_account.account_type = 'cash' then
    select session.id into v_session_id from public.cash_register_sessions session
    where session.user_id = v_owner_id and session.status = 'open'
    order by session.opened_at desc limit 1 for update;
    if v_session_id is not null then
      insert into public.cash_movements(
        session_id, user_id, type, amount, description, expense_payment_id, financial_movement_id
      ) values (
        v_session_id, v_owner_id, 'out', round(p_amount, 2),
        concat('Conta a pagar: ', v_expense.description), v_payment_id, v_movement_id
      );
    end if;
  end if;

  v_paid := round(v_paid + p_amount, 2);
  v_status := case when v_paid >= v_expense.amount then 'paid' else 'partially_paid' end;
  update public.expenses
  set paid_amount = v_paid,
      status = v_status,
      paid_at = case when v_status = 'paid' then now() else null end
  where id = v_expense.id;

  return jsonb_build_object(
    'payment_id', v_payment_id, 'movement_id', v_movement_id,
    'paid_amount', v_paid, 'remaining_amount', greatest(v_expense.amount - v_paid, 0),
    'status', v_status, 'responsible_name', v_operator_name
  );
exception
  when unique_violation then
    select id into v_payment_id from public.expense_payments
    where user_id = v_owner_id and operation_id = p_operation_id;
    if v_payment_id is not null then
      return jsonb_build_object('payment_id', v_payment_id, 'duplicate', true);
    end if;
    raise;
end;
$$;

revoke all on function public.record_expense_payment(uuid,numeric,date,text,uuid,text,text,text,text,uuid,uuid) from public;
grant execute on function public.record_expense_payment(uuid,numeric,date,text,uuid,text,text,text,text,uuid,uuid) to authenticated;

create or replace function public.reverse_expense_payment(
  p_payment_id uuid,
  p_reason text,
  p_admin_pin text,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_payment public.expense_payments%rowtype;
  v_expense public.expenses%rowtype;
  v_account public.financial_accounts%rowtype;
  v_original public.financial_movements%rowtype;
  v_waiter_id uuid;
  v_waiter_name text;
  v_paid numeric(12,2);
  v_status text;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Informe o motivo do estorno.'; end if;
  if nullif(trim(coalesce(p_admin_pin, '')), '') is null then raise exception 'Informe a senha/PIN de autorização.'; end if;

  select waiter.id, waiter.name into v_waiter_id, v_waiter_name
  from public.waiters waiter
  where waiter.user_id = v_owner_id and waiter.active = true and waiter.pin = trim(p_admin_pin)
    and (waiter.role = 'admin'
      or coalesce((waiter.permissions->>'admin')::boolean, false)
      or coalesce((waiter.permissions->>'expense_payments_reverse')::boolean, false))
  order by waiter.created_at limit 1;
  if v_waiter_id is null then raise exception 'PIN inválido ou operador sem permissão para estornar pagamentos.'; end if;

  select * into v_payment from public.expense_payments
  where id = p_payment_id and user_id = v_owner_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  if v_payment.status = 'reversed' then raise exception 'Este pagamento já foi estornado.'; end if;

  select * into v_expense from public.expenses where id = v_payment.expense_id for update;
  select * into v_account from public.financial_accounts where id = v_payment.financial_account_id for update;
  select * into v_original from public.financial_movements
  where expense_payment_id = v_payment.id and reverses_movement_id is null for update;

  update public.expense_payments set
    status = 'reversed', reversed_at = now(), reversal_reason = trim(p_reason),
    reversed_by_user_id = v_owner_id, reversed_by_waiter_id = v_waiter_id,
    reversed_by_name = v_waiter_name
  where id = v_payment.id;

  if v_original.id is not null then
    update public.financial_movements set status = 'reversed' where id = v_original.id;
    insert into public.financial_movements(
      user_id, financial_account_id, expense_id, expense_payment_id, direction, amount,
      movement_at, description, reverses_movement_id, operation_id, created_by
    ) values (
      v_owner_id, v_account.id, v_expense.id, v_payment.id, 'in', v_payment.amount,
      now(), concat('Estorno de pagamento: ', v_expense.description), v_original.id,
      p_operation_id, v_owner_id
    );
  end if;

  update public.financial_accounts
  set current_balance = current_balance + v_payment.amount, updated_at = now()
  where id = v_account.id;

  if exists (select 1 from public.cash_movements where expense_payment_id = v_payment.id and type = 'out') then
    insert into public.cash_movements(session_id, user_id, type, amount, description, expense_payment_id)
    select movement.session_id, v_owner_id, 'in', v_payment.amount,
      concat('Estorno de conta a pagar: ', v_expense.description), v_payment.id
    from public.cash_movements movement
    where movement.expense_payment_id = v_payment.id and movement.type = 'out'
    order by movement.created_at limit 1;
  end if;

  select coalesce(sum(payment.amount) filter (where payment.status = 'posted'), 0)
    into v_paid from public.expense_payments payment where payment.expense_id = v_expense.id;
  v_status := case
    when v_paid >= v_expense.amount then 'paid'
    when v_paid > 0 then 'partially_paid'
    when v_expense.due_date is not null and v_expense.due_date < current_date then 'overdue'
    else 'open' end;
  update public.expenses set paid_amount = v_paid, status = v_status,
    paid_at = case when v_status = 'paid' then paid_at else null end
  where id = v_expense.id;

  return jsonb_build_object('payment_id', v_payment.id, 'status', v_status,
    'paid_amount', v_paid, 'reversed_by_name', v_waiter_name);
end;
$$;
revoke all on function public.reverse_expense_payment(uuid,text,text,uuid) from public;
grant execute on function public.reverse_expense_payment(uuid,text,text,uuid) to authenticated;

create or replace function public.update_payable(
  p_expense_id uuid,
  p_description text,
  p_amount numeric,
  p_category text,
  p_due_date date,
  p_operator_id uuid default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_paid numeric(12,2);
  v_operator public.waiters%rowtype;
begin
  if nullif(trim(coalesce(p_description, '')), '') is null then raise exception 'Informe a descrição.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor válido.'; end if;
  select * into v_expense from public.expenses
  where id = p_expense_id and user_id = v_owner_id for update;
  if not found then raise exception 'Conta a pagar não encontrada.'; end if;
  if p_operator_id is not null then
    select * into v_operator from public.waiters
    where id = p_operator_id and user_id = v_owner_id and active = true;
    if not found or not (v_operator.role = 'admin'
      or coalesce((v_operator.permissions->>'admin')::boolean, false)
      or coalesce((v_operator.permissions->>'expenses_manage')::boolean, false)) then
      raise exception 'Operador sem permissão para editar contas.';
    end if;
  end if;
  if v_expense.status = 'cancelled' or v_expense.is_active = false then raise exception 'Conta cancelada não pode ser editada.'; end if;
  v_paid := coalesce(v_expense.paid_amount, 0);
  if round(p_amount, 2) < v_paid then raise exception 'O valor não pode ser menor que o total já pago.'; end if;

  update public.expenses set description = trim(p_description), amount = round(p_amount, 2),
    category = nullif(trim(coalesce(p_category, '')), ''), due_date = p_due_date,
    status = case when round(p_amount, 2) <= v_paid then 'paid'
      when v_paid > 0 then 'partially_paid'
      when p_due_date < current_date then 'overdue' else 'open' end,
    paid_at = case when round(p_amount, 2) <= v_paid then coalesce(paid_at, now()) else null end
  where id = p_expense_id returning * into v_expense;
  return v_expense;
end;
$$;
revoke all on function public.update_payable(uuid,text,numeric,text,date,uuid) from public;
grant execute on function public.update_payable(uuid,text,numeric,text,date,uuid) to authenticated;

create or replace function public.cancel_payable(
  p_expense_id uuid,
  p_reason text,
  p_operator_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_operator public.waiters%rowtype;
  v_name text := 'Administrador';
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Informe o motivo do cancelamento.'; end if;
  if p_operator_id is not null then
    select * into v_operator from public.waiters where id = p_operator_id and user_id = v_owner_id and active = true;
    if not found or not (v_operator.role = 'admin'
      or coalesce((v_operator.permissions->>'admin')::boolean, false)
      or coalesce((v_operator.permissions->>'expenses_manage')::boolean, false)) then
      raise exception 'Operador sem permissão para cancelar contas.';
    end if;
    v_name := v_operator.name;
  end if;
  select * into v_expense from public.expenses
  where id = p_expense_id and user_id = v_owner_id for update;
  if not found then raise exception 'Conta a pagar não encontrada.'; end if;
  if v_expense.status = 'cancelled' then raise exception 'Esta conta já está cancelada.'; end if;
  if coalesce(v_expense.paid_amount, 0) > 0 then raise exception 'Estorne os pagamentos desta conta antes de cancelá-la.'; end if;

  update public.expenses set status = 'cancelled', cancelled_at = now(),
    cancellation_reason = trim(p_reason), cancelled_by = v_owner_id,
    cancelled_by_waiter_id = p_operator_id, cancelled_by_name = v_name
  where id = p_expense_id;
  return jsonb_build_object('expense_id', p_expense_id, 'status', 'cancelled', 'cancelled_by_name', v_name);
end;
$$;
revoke all on function public.cancel_payable(uuid,text,uuid) from public;
grant execute on function public.cancel_payable(uuid,text,uuid) to authenticated;

comment on table public.expense_payments is 'Baixas imutáveis de contas a pagar; estornos alteram status e preservam o registro.';
comment on table public.financial_movements is 'Razão financeiro gerado por baixas e estornos, vinculado à conta financeira.';
