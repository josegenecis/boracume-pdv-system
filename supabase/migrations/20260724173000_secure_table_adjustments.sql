-- Ações que reduzem ou retiram valores de uma mesa exigem um operador
-- administrador identificado e deixam uma trilha imutável de auditoria.

alter table public.staff_consumptions
  add column if not exists authorized_waiter_id uuid references public.waiters(id) on delete set null,
  add column if not exists settled_by_waiter_id uuid references public.waiters(id) on delete set null;

alter table public.tables
  add column if not exists archived_by_waiter_id uuid references public.waiters(id) on delete set null;

create table if not exists public.table_item_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  account_id uuid references public.table_accounts(id) on delete set null,
  item_snapshot jsonb not null,
  item_index integer not null,
  cancelled_amount numeric(12,2) not null default 0,
  reason text not null,
  authorized_waiter_id uuid references public.waiters(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_table_item_cancellations_user_created
  on public.table_item_cancellations(user_id, created_at desc);

alter table public.table_item_cancellations enable row level security;

drop policy if exists "Users view own table item cancellations" on public.table_item_cancellations;
create policy "Users view own table item cancellations"
  on public.table_item_cancellations
  for select
  using (auth.uid() = user_id);

create or replace function public.is_my_admin_waiter(p_waiter_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
      from public.waiters
     where id = p_waiter_id
       and user_id = auth.uid()
       and active = true
       and (role = 'admin' or coalesce((permissions ->> 'admin')::boolean, false))
  );
$$;

revoke all on function public.defer_table_account_to_staff(uuid, text, date, text) from authenticated;
revoke all on function public.settle_staff_consumption(uuid, text) from authenticated;

create or replace function public.defer_table_account_to_staff_authorized(
  p_account_id uuid,
  p_employee_name text,
  p_due_date date,
  p_notes text,
  p_authorized_waiter_id uuid
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
  if not public.is_my_admin_waiter(p_authorized_waiter_id) then
    raise exception 'A autorização de um administrador é obrigatória.';
  end if;
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
    user_id, employee_name, source_table_id, source_account_id, items, amount,
    due_date, notes, created_by, authorized_waiter_id
  ) values (
    v_account.user_id, trim(p_employee_name), v_account.table_id, v_account.id,
    coalesce(v_account.items, '[]'::jsonb), coalesce(v_account.total, 0),
    p_due_date, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), p_authorized_waiter_id
  )
  returning id into v_receivable_id;

  update public.table_accounts
     set status = 'employee_receivable', table_id = null, closed_at = now(), updated_at = now()
   where id = v_account.id;

  update public.tables
     set status = 'available', updated_at = now()
   where id = v_account.table_id and user_id = auth.uid();

  return v_receivable_id;
end;
$$;

grant execute on function public.defer_table_account_to_staff_authorized(uuid, text, date, text, uuid) to authenticated;

create or replace function public.settle_staff_consumption_authorized(
  p_receivable_id uuid,
  p_payment_method text,
  p_authorized_waiter_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_my_admin_waiter(p_authorized_waiter_id) then
    raise exception 'A autorização de um administrador é obrigatória.';
  end if;

  update public.staff_consumptions
     set status = 'paid',
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         paid_at = now(),
         paid_by = auth.uid(),
         settled_by_waiter_id = p_authorized_waiter_id,
         updated_at = now()
   where id = p_receivable_id
     and user_id = auth.uid()
     and status = 'open';
  if not found then
    raise exception 'Consumo pendente não encontrado ou já baixado.';
  end if;
end;
$$;

grant execute on function public.settle_staff_consumption_authorized(uuid, text, uuid) to authenticated;

create or replace function public.cancel_table_account_item_authorized(
  p_account_id uuid,
  p_item_index integer,
  p_reason text,
  p_authorized_waiter_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account public.table_accounts%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_total numeric(12,2);
begin
  if not public.is_my_admin_waiter(p_authorized_waiter_id) then
    raise exception 'A autorização de um administrador é obrigatória.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if p_item_index < 0 then
    raise exception 'Item inválido.';
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

  v_item := coalesce(v_account.items, '[]'::jsonb) -> p_item_index;
  if v_item is null then
    raise exception 'O item mudou ou não existe mais. Atualize a mesa e tente novamente.';
  end if;

  v_items := coalesce(v_account.items, '[]'::jsonb) - p_item_index;
  select coalesce(sum(coalesce((entry ->> 'subtotal')::numeric, 0)), 0)
    into v_total
    from jsonb_array_elements(v_items) entry;

  insert into public.table_item_cancellations (
    user_id, table_id, account_id, item_snapshot, item_index,
    cancelled_amount, reason, authorized_waiter_id, created_by
  ) values (
    v_account.user_id, v_account.table_id, v_account.id, v_item, p_item_index,
    coalesce((v_item ->> 'subtotal')::numeric, 0), trim(p_reason),
    p_authorized_waiter_id, auth.uid()
  );

  update public.table_accounts
     set items = v_items, total = v_total, updated_at = now()
   where id = v_account.id;

  return jsonb_build_object('items', v_items, 'total', v_total);
end;
$$;

grant execute on function public.cancel_table_account_item_authorized(uuid, integer, text, uuid) to authenticated;

create or replace function public.archive_table_authorized(
  p_table_id uuid,
  p_authorized_waiter_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_my_admin_waiter(p_authorized_waiter_id) then
    raise exception 'A autorização de um administrador é obrigatória.';
  end if;
  if exists (
    select 1 from public.table_accounts
     where table_id = p_table_id
       and user_id = auth.uid()
       and status in ('open', 'payment_pending')
  ) then
    raise exception 'A mesa possui conta aberta e não pode ser arquivada.';
  end if;

  update public.tables
     set archived_at = now(),
         archived_by = auth.uid(),
         archived_by_waiter_id = p_authorized_waiter_id,
         status = 'available',
         updated_at = now()
   where id = p_table_id
     and user_id = auth.uid()
     and archived_at is null;
  if not found then
    raise exception 'Mesa não encontrada ou já arquivada.';
  end if;
end;
$$;

grant execute on function public.archive_table_authorized(uuid, uuid) to authenticated;
