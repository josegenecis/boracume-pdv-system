-- Cancela a conta operacional da mesa sem apagar o histórico.
-- A ação sempre exige um operador administrador e mantém um snapshot imutável
-- para auditoria, inclusive quando a mesa está ocupada sem itens.

create table if not exists public.table_account_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  session_id uuid references public.table_sessions(id) on delete set null,
  accounts_snapshot jsonb not null default '[]'::jsonb,
  items_snapshot jsonb not null default '[]'::jsonb,
  orders_snapshot jsonb not null default '[]'::jsonb,
  cancelled_amount numeric(12,2) not null default 0,
  reason text not null,
  authorized_waiter_id uuid references public.waiters(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_table_account_cancellations_user_created
  on public.table_account_cancellations(user_id, created_at desc);

create index if not exists idx_table_account_cancellations_table_created
  on public.table_account_cancellations(table_id, created_at desc);

alter table public.table_account_cancellations enable row level security;

drop policy if exists "Users view own table account cancellations"
  on public.table_account_cancellations;
create policy "Users view own table account cancellations"
  on public.table_account_cancellations
  for select
  using (auth.uid() = user_id);

create or replace function public.cancel_table_account_authorized(
  p_table_id uuid,
  p_reason text,
  p_admin_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_session_id uuid;
  v_account_ids uuid[] := array[]::uuid[];
  v_accounts_snapshot jsonb := '[]'::jsonb;
  v_items_snapshot jsonb := '[]'::jsonb;
  v_orders_snapshot jsonb := '[]'::jsonb;
  v_order_numbers text[] := array[]::text[];
  v_cancelled_amount numeric(12,2) := 0;
  v_received_amount numeric(12,2) := 0;
  v_audit_id uuid;
  v_authorized_waiter_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Sessão expirada. Entre novamente no sistema.';
  end if;
  if nullif(trim(coalesce(p_admin_pin, '')), '') is null then
    raise exception 'Informe a senha/PIN do administrador.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select waiter.id
    into v_authorized_waiter_id
    from public.waiters waiter
   where waiter.user_id = v_owner_id
     and waiter.active = true
     and waiter.pin = trim(p_admin_pin)
     and (
       waiter.role = 'admin'
       or coalesce((waiter.permissions ->> 'admin')::boolean, false)
     )
   order by waiter.created_at
   limit 1;
  if v_authorized_waiter_id is null then
    raise exception 'Senha/PIN inválido ou operador sem permissão de administrador.';
  end if;

  perform 1
    from public.tables
   where id = p_table_id
     and user_id = v_owner_id
     and archived_at is null
   for update;
  if not found then
    raise exception 'Mesa não encontrada.';
  end if;

  select id
    into v_session_id
    from public.table_sessions
   where table_id = p_table_id
     and user_id = v_owner_id
     and status in ('open', 'serving', 'payment_pending')
   order by opened_at desc
   limit 1
   for update;

  select
    coalesce(array_agg(account.id), array[]::uuid[]),
    coalesce(jsonb_agg(to_jsonb(account) order by account.opened_at), '[]'::jsonb),
    coalesce(sum(account.total), 0)
    into v_account_ids, v_accounts_snapshot, v_cancelled_amount
    from public.table_accounts account
   where account.user_id = v_owner_id
     and account.status in ('open', 'payment_pending')
     and (
       account.table_id = p_table_id
       or (v_session_id is not null and account.session_id = v_session_id)
     );

  select coalesce(sum(payment.amount), 0)
    into v_received_amount
    from public.payments payment
   where payment.user_id = v_owner_id
     and (
       (v_session_id is not null and payment.session_id = v_session_id)
       or payment.account_id = any(v_account_ids)
     );

  if v_received_amount > 0 then
    raise exception
      'Esta conta possui R$ % já recebidos. Estorne o pagamento antes de cancelar e liberar a mesa.',
      to_char(v_received_amount, 'FM999G999G990D00');
  end if;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at), '[]'::jsonb)
    into v_items_snapshot
    from public.order_items item
   where (v_session_id is not null and item.session_id = v_session_id)
      or item.account_id = any(v_account_ids);

  select
    coalesce(jsonb_agg(to_jsonb(ordem) order by ordem.created_at), '[]'::jsonb),
    coalesce(array_agg(ordem.order_number) filter (where ordem.order_number is not null), array[]::text[])
    into v_orders_snapshot, v_order_numbers
    from public.orders ordem
   where ordem.user_id = v_owner_id
     and (
       (v_session_id is not null and ordem.session_id = v_session_id)
       or ordem.account_id = any(v_account_ids)
     );

  insert into public.table_account_cancellations (
    user_id,
    table_id,
    session_id,
    accounts_snapshot,
    items_snapshot,
    orders_snapshot,
    cancelled_amount,
    reason,
    authorized_waiter_id,
    created_by
  ) values (
    v_owner_id,
    p_table_id,
    v_session_id,
    v_accounts_snapshot,
    v_items_snapshot,
    v_orders_snapshot,
    v_cancelled_amount,
    trim(p_reason),
    v_authorized_waiter_id,
    v_owner_id
  )
  returning id into v_audit_id;

  update public.order_items
     set status = 'cancelled', updated_at = now()
   where ((v_session_id is not null and session_id = v_session_id)
      or account_id = any(v_account_ids))
     and status <> 'cancelled';

  update public.orders
     set status = 'cancelled', updated_at = now()
   where user_id = v_owner_id
     and (
       (v_session_id is not null and session_id = v_session_id)
       or account_id = any(v_account_ids)
     )
     and status <> 'cancelled';

  if cardinality(v_order_numbers) > 0 then
    update public.kitchen_orders
       set status = 'cancelled', updated_at = now()
     where user_id = v_owner_id
       and order_number = any(v_order_numbers)
       and status <> 'cancelled';
  end if;

  if cardinality(v_account_ids) > 0 then
    update public.table_accounts
       set status = 'cancelled',
           table_id = null,
           closed_at = now(),
           updated_at = now()
     where id = any(v_account_ids);
  end if;

  if v_session_id is not null then
    update public.table_sessions
       set status = 'closed', closed_at = now(), updated_at = now()
     where id = v_session_id;
  end if;

  update public.tables
     set status = 'available', updated_at = now()
   where id = p_table_id
     and user_id = v_owner_id;

  return jsonb_build_object(
    'audit_id', v_audit_id,
    'cancelled_amount', v_cancelled_amount,
    'accounts_cancelled', cardinality(v_account_ids),
    'session_id', v_session_id
  );
end;
$$;

revoke all on function public.cancel_table_account_authorized(uuid, text, text) from public;
grant execute on function public.cancel_table_account_authorized(uuid, text, text) to authenticated;
