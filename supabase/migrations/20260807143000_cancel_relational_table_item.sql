-- Cancela itens da estrutura relacional de mesas por ID. O fluxo anterior
-- operava apenas sobre o JSON legado table_accounts.items.
create or replace function public.cancel_table_order_item_authorized(
  p_account_id uuid,
  p_item_id uuid,
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
  v_item public.order_items%rowtype;
  v_options jsonb;
  v_snapshot jsonb;
  v_cancelled_amount numeric(12,2);
  v_total numeric(12,2);
  v_item_index integer;
begin
  if not public.is_my_admin_waiter(p_authorized_waiter_id) then
    raise exception 'A autorização de um administrador é obrigatória.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v_account
    from public.table_accounts
   where id = p_account_id
     and user_id = auth.uid()
     and status in ('open', 'payment_pending')
   for update;
  if not found then
    raise exception 'Conta da mesa não encontrada ou já encerrada.';
  end if;

  select * into v_item
    from public.order_items
   where id = p_item_id
     and account_id = v_account.id
     and status <> 'cancelled'
   for update;
  if not found then
    raise exception 'O item já foi cancelado ou não pertence a esta mesa. Atualize a mesa e tente novamente.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', option_name,
           'price', price,
           'quantity', quantity
         ) order by created_at), '[]'::jsonb),
         coalesce(sum(price * greatest(quantity, 1)), 0)
    into v_options, v_cancelled_amount
    from public.order_item_options
   where order_item_id = v_item.id;

  v_cancelled_amount := round((v_item.unit_price + v_cancelled_amount) * greatest(v_item.quantity, 1), 2);
  select count(*)::integer into v_item_index
    from public.order_items
   where account_id = v_account.id
     and status <> 'cancelled'
     and (created_at < v_item.created_at or (created_at = v_item.created_at and id < v_item.id));

  v_snapshot := jsonb_build_object(
    'id', v_item.id,
    'product_id', v_item.product_id,
    'product_name', v_item.product_name,
    'quantity', v_item.quantity,
    'unit_price', v_item.unit_price,
    'subtotal', v_cancelled_amount,
    'notes', v_item.notes,
    'status_before_cancellation', v_item.status,
    'options', v_options
  );

  insert into public.table_item_cancellations (
    user_id, table_id, account_id, item_snapshot, item_index,
    cancelled_amount, reason, authorized_waiter_id, created_by
  ) values (
    v_account.user_id, v_account.table_id, v_account.id, v_snapshot, v_item_index,
    v_cancelled_amount, trim(p_reason), p_authorized_waiter_id, auth.uid()
  );

  update public.order_items
     set status = 'cancelled', updated_at = now()
   where id = v_item.id;

  select coalesce(sum(
           (item.unit_price + coalesce(options.option_total, 0)) * greatest(item.quantity, 1)
         ), 0)
    into v_total
    from public.order_items item
    left join lateral (
      select sum(option.price * greatest(option.quantity, 1)) as option_total
        from public.order_item_options option
       where option.order_item_id = item.id
    ) options on true
   where item.account_id = v_account.id
     and item.status <> 'cancelled';

  update public.table_accounts
     set total = round(v_total, 2), updated_at = now()
   where id = v_account.id;

  return jsonb_build_object(
    'item_id', v_item.id,
    'previous_status', v_item.status,
    'total', round(v_total, 2)
  );
end;
$$;

grant execute on function public.cancel_table_order_item_authorized(uuid, uuid, text, uuid) to authenticated;
