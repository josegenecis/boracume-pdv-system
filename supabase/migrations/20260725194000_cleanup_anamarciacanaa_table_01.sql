-- Limpa exclusivamente a sessão de teste órfã da Mesa 01 informada pelo cliente.
-- A operação aborta se encontrar pagamento, mais de uma sessão ativa ou um
-- pedido que não corresponda ao teste de mesa pendente, preservando qualquer
-- movimento financeiro legítimo.
do $$
declare
  v_user_id uuid;
  v_table_id uuid;
  v_session_id uuid;
  v_active_sessions integer;
  v_payments integer;
  v_linked_orders integer;
  v_order_id uuid;
  v_order_number text;
  v_order_status text;
  v_order_total numeric;
  v_legacy_accounts integer;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = 'anamarciacanaa@gmail.com'
   limit 1;

  if v_user_id is null then
    raise exception 'Conta anamarciacanaa@gmail.com não encontrada; nenhuma alteração realizada.';
  end if;

  select id
    into v_table_id
    from public.tables
   where user_id = v_user_id
     and table_number = 1
     and archived_at is null
   order by created_at
   limit 1;

  if v_table_id is null then
    raise exception 'Mesa 01 de anamarciacanaa@gmail.com não encontrada; nenhuma alteração realizada.';
  end if;

  select count(*)
    into v_active_sessions
    from public.table_sessions
   where user_id = v_user_id
     and table_id = v_table_id
     and status in ('open', 'serving', 'payment_pending');

  if v_active_sessions > 1 then
    raise exception 'Foram encontradas % sessões ativas na Mesa 01; limpeza abortada para auditoria.', v_active_sessions;
  end if;

  select id
    into v_session_id
    from public.table_sessions
   where user_id = v_user_id
     and table_id = v_table_id
     and status in ('open', 'serving', 'payment_pending')
   order by opened_at desc
   limit 1;

  if v_session_id is not null then
    select count(*)
      into v_payments
      from public.payments
     where session_id = v_session_id;

    select count(distinct order_id)
      into v_linked_orders
      from public.order_items
     where session_id = v_session_id
       and order_id is not null;

    if v_payments > 0 or v_linked_orders > 1 then
      raise exception
        'A sessão da Mesa 01 possui % pagamento(s) e % pedido(s) vinculado(s); limpeza abortada.',
        v_payments,
        v_linked_orders;
    end if;

    if v_linked_orders = 1 then
      select order_row.id, order_row.order_number, order_row.status, order_row.total
        into v_order_id, v_order_number, v_order_status, v_order_total
        from public.orders order_row
       where order_row.id = (
         select order_id
           from public.order_items
          where session_id = v_session_id
            and order_id is not null
          limit 1
       )
         and order_row.user_id = v_user_id
         and order_row.table_id = v_table_id
         and order_row.order_type = 'dine_in'
         and order_row.payment_method = 'pendente'
         and order_row.customer_name ilike 'Mesa 1%'
       limit 1;

      if v_order_id is null then
        raise exception
          'O pedido vinculado à Mesa 01 não corresponde ao pedido de teste pendente; limpeza abortada.';
      end if;

      delete from public.orders
       where id = v_order_id;
    end if;

    delete from public.table_sessions
     where id = v_session_id;
  end if;

  delete from public.table_accounts
   where user_id = v_user_id
     and table_id = v_table_id
     and session_id is null
     and status in ('open', 'payment_pending')
     and coalesce(total, 0) = 0
     and coalesce(jsonb_array_length(items), 0) = 0;

  get diagnostics v_legacy_accounts = row_count;

  update public.tables
     set status = 'available',
         updated_at = now()
   where id = v_table_id;

  raise notice
    'Mesa 01 limpa para anamarciacanaa@gmail.com. Sessão removida: %, pedido removido: % (% / % / R$ %), contas legadas vazias removidas: %.',
    v_session_id is not null,
    coalesce(v_order_id::text, 'nenhum'),
    coalesce(v_order_number, 'sem número'),
    coalesce(v_order_status, 'sem status'),
    coalesce(v_order_total, 0),
    v_legacy_accounts;
end;
$$;
