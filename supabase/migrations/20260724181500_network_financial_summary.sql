-- Visão executiva da rede disponível somente para a conta proprietária.
-- As subconsultas evitam multiplicar vendas por despesas ao consolidar.

drop function if exists public.get_my_network_summary(timestamptz);

create function public.get_my_network_summary(
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
