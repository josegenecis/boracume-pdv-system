-- Auditoria financeira profissional:
-- 1) estorno de despesa sempre exige motivo e PIN administrativo;
-- 2) cancelamento financeiro de venda fica restrito ao caixa aberto atual;
-- 3) ambos preservam snapshots imutáveis para conferência posterior.

alter table public.expenses
  add column if not exists reversed_by_waiter_id uuid references public.waiters(id) on delete set null;

alter table public.expenses
  add column if not exists reversed_by_name text;

create or replace function public.reverse_expense_authorized(
  p_expense_id uuid,
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
  v_waiter_id uuid;
  v_waiter_name text;
  v_expense public.expenses%rowtype;
begin
  if v_owner_id is null then
    raise exception 'Sessão expirada. Entre novamente no sistema.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo do estorno.';
  end if;
  if nullif(trim(coalesce(p_admin_pin, '')), '') is null then
    raise exception 'Informe a senha/PIN do administrador.';
  end if;

  select waiter.id, waiter.name
    into v_waiter_id, v_waiter_name
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

  if v_waiter_id is null then
    raise exception 'Senha/PIN inválido ou operador sem permissão de administrador.';
  end if;

  select *
    into v_expense
    from public.expenses
   where id = p_expense_id
     and user_id = v_owner_id
   for update;

  if not found then
    raise exception 'Despesa não encontrada.';
  end if;
  if v_expense.is_active = false then
    raise exception 'Esta despesa já foi estornada.';
  end if;

  update public.expenses
     set is_active = false,
         reversed_at = now(),
         reversal_reason = trim(p_reason),
         reversed_by = v_owner_id,
         reversed_by_waiter_id = v_waiter_id,
         reversed_by_name = v_waiter_name
   where id = p_expense_id;

  return jsonb_build_object(
    'expense_id', p_expense_id,
    'reversed_at', now(),
    'reversed_by_name', v_waiter_name
  );
end;
$$;

revoke all on function public.reverse_expense_authorized(uuid, text, text) from public;
grant execute on function public.reverse_expense_authorized(uuid, text, text) to authenticated;

create table if not exists public.finance_sale_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  cash_register_session_id uuid references public.cash_register_sessions(id) on delete set null,
  original_status text not null,
  order_snapshot jsonb not null,
  amount numeric(12,2) not null default 0,
  payment_method text,
  reason text not null,
  authorized_waiter_id uuid references public.waiters(id) on delete set null,
  authorized_waiter_name text,
  created_by uuid references auth.users(id) on delete set null,
  refund_requested boolean not null default false,
  refund_status text not null default 'not_requested',
  operation_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, operation_id)
);

create index if not exists finance_sale_cancellations_user_created_idx
  on public.finance_sale_cancellations(user_id, created_at desc);

create index if not exists finance_sale_cancellations_order_idx
  on public.finance_sale_cancellations(order_id);

alter table public.finance_sale_cancellations enable row level security;

drop policy if exists "Users view own financial sale cancellations"
  on public.finance_sale_cancellations;
create policy "Users view own financial sale cancellations"
  on public.finance_sale_cancellations
  for select
  using (auth.uid() = user_id);

-- Estornos não podem continuar compondo o consolidado da rede.
create or replace function public.get_my_network_summary(
  p_start_date timestamptz default date_trunc('month', now())
)
returns table (
  store_user_id uuid,
  store_name text,
  order_count bigint,
  cancelled_order_count bigint,
  gross_sales numeric,
  expense_total numeric,
  operational_balance numeric,
  average_ticket numeric,
  has_open_cash boolean,
  last_sale_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (select 1 from public.store_networks where owner_user_id = v_user_id) then
    raise exception 'network_owner_required';
  end if;

  return query
    select
      store.store_user_id,
      store.store_name,
      coalesce(sales.order_count, 0)::bigint,
      coalesce(sales.cancelled_order_count, 0)::bigint,
      coalesce(sales.gross_sales, 0)::numeric,
      coalesce(costs.expense_total, 0)::numeric,
      (coalesce(sales.gross_sales, 0) - coalesce(costs.expense_total, 0))::numeric,
      coalesce(sales.average_ticket, 0)::numeric,
      coalesce(cash.has_open_cash, false),
      sales.last_sale_at
    from public.store_networks network
    join public.store_network_stores store
      on store.network_id = network.id
     and store.status = 'active'
    left join lateral (
      select
        count(*) filter (where orders.status <> 'cancelled')::bigint as order_count,
        count(*) filter (where orders.status = 'cancelled')::bigint as cancelled_order_count,
        coalesce(sum(orders.total) filter (where orders.status <> 'cancelled'), 0)::numeric as gross_sales,
        coalesce(avg(orders.total) filter (where orders.status <> 'cancelled'), 0)::numeric as average_ticket,
        max(orders.created_at) filter (where orders.status <> 'cancelled') as last_sale_at
      from public.orders
      where orders.user_id = store.store_user_id
        and orders.created_at >= p_start_date
    ) sales on true
    left join lateral (
      select coalesce(sum(expenses.amount), 0)::numeric as expense_total
      from public.expenses
      where expenses.user_id = store.store_user_id
        and expenses.is_active = true
        and expenses.date >= (p_start_date at time zone 'America/Fortaleza')::date
    ) costs on true
    left join lateral (
      select exists (
        select 1
        from public.cash_register_sessions
        where cash_register_sessions.user_id = store.store_user_id
          and cash_register_sessions.status = 'open'
      ) as has_open_cash
    ) cash on true
    where network.owner_user_id = v_user_id
    order by store.store_name;
end;
$$;

revoke all on function public.get_my_network_summary(timestamptz) from public;
grant execute on function public.get_my_network_summary(timestamptz) to authenticated;
