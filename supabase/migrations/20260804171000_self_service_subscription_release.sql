create or replace function public.request_my_subscription_temporary_release()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_billing_owner_id uuid;
  v_subscription public.subscriptions%rowtype;
  v_status text;
  v_period_end timestamptz;
  v_granted_at timestamptz := now();
  v_access_until timestamptz := now() + interval '24 hours';
begin
  if v_user_id is null then
    raise exception 'Faça login novamente para liberar o sistema.';
  end if;

  select coalesce(
    (
      select network.owner_user_id
      from public.store_network_stores store
      join public.store_networks network on network.id = store.network_id
      where store.store_user_id = v_user_id
        and store.status = 'active'
      limit 1
    ),
    v_user_id
  ) into v_billing_owner_id;

  select subscription.*
    into v_subscription
  from public.subscriptions subscription
  where subscription.user_id = v_billing_owner_id
  order by subscription.updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Assinatura não encontrada. Escolha um plano para continuar.';
  end if;

  v_status := lower(coalesce(v_subscription.status, ''));

  if v_subscription.billing_exempt
    or (v_subscription.access_override_until is not null and v_subscription.access_override_until > now())
    or (v_status in ('trial', 'trialing', 'teste') and v_subscription.trial_end is not null and v_subscription.trial_end > now())
    or (v_status in ('active', 'paid', 'trialing_paid', 'current') and v_subscription.current_period_end is not null and v_subscription.current_period_end > now()) then
    return jsonb_build_object(
      'ok', true,
      'already_allowed', true,
      'access_until', coalesce(v_subscription.access_override_until, v_subscription.current_period_end, v_subscription.trial_end)
    );
  end if;

  v_period_end := case
    when v_status in ('trial', 'trialing', 'teste') then v_subscription.trial_end
    else v_subscription.current_period_end
  end;

  if (
    v_period_end is not null
    and v_subscription.access_override_granted_for_period_end is not distinct from v_period_end
  ) or (
    v_period_end is null
    and v_subscription.access_override_granted_at is not null
  ) then
    raise exception 'A liberação de 24 horas já foi usada neste vencimento. Agora é necessário realizar o pagamento.';
  end if;

  update public.subscriptions
  set access_override_until = v_access_until,
      access_override_granted_at = v_granted_at,
      access_override_granted_for_period_end = v_period_end,
      access_override_granted_by = 'self_service:' || v_user_id::text,
      updated_at = v_granted_at
  where id = v_subscription.id;

  insert into public.subscription_access_events (
    subscription_id,
    user_id,
    event_type,
    actor,
    period_end,
    access_until,
    metadata
  ) values (
    v_subscription.id,
    v_billing_owner_id,
    'temporary_release',
    'self_service:' || v_user_id::text,
    v_period_end,
    v_access_until,
    jsonb_build_object('requested_by', v_user_id, 'channel', 'payment_lock')
  );

  return jsonb_build_object(
    'ok', true,
    'already_allowed', false,
    'access_until', v_access_until
  );
end;
$$;

revoke all on function public.request_my_subscription_temporary_release() from public, anon;
grant execute on function public.request_my_subscription_temporary_release() to authenticated;

comment on function public.request_my_subscription_temporary_release() is
  'Grants the authenticated billing account one audited 24-hour self-service release per overdue period.';
