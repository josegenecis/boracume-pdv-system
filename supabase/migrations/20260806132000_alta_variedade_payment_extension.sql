-- Prorrogacao administrativa solicitada para a Alta Variedade.
-- O acesso permanece liberado ate o fim de 12/08/2026 (America/Fortaleza)
-- e volta a seguir a regra normal de cobranca na virada para 13/08.
do $$
declare
  v_user_id uuid;
  v_subscription_id uuid;
  v_match_count integer;
  v_access_until timestamptz := timestamptz '2026-08-13 00:00:00-03';
begin
  select count(*), (array_agg(profile.id))[1]
    into v_match_count, v_user_id
  from public.profiles profile
  where profile.restaurant_name ilike '%Alta Variedade%';

  if v_match_count <> 1 then
    raise exception 'Expected exactly one Alta Variedade account, found %.', v_match_count;
  end if;

  select subscription.id
    into v_subscription_id
  from public.subscriptions subscription
  where subscription.user_id = v_user_id
  order by subscription.updated_at desc, subscription.created_at desc
  limit 1
  for update;

  if v_subscription_id is null then
    raise exception 'Alta Variedade subscription was not found.';
  end if;

  update public.subscriptions
  set access_override_until = v_access_until,
      access_override_granted_by = 'manual_support:payment_extension',
      updated_at = now()
  where id = v_subscription_id;

  insert into public.subscription_access_events (
    subscription_id,
    user_id,
    event_type,
    actor,
    period_end,
    access_until,
    metadata
  )
  select
    subscription.id,
    subscription.user_id,
    'temporary_release',
    'manual_support:payment_extension',
    coalesce(subscription.current_period_end, subscription.trial_end),
    v_access_until,
    jsonb_build_object(
      'reason', 'customer_requested_payment_deadline',
      'deadline_local', '2026-08-12 23:59:59 America/Fortaleza',
      'requested_on', '2026-08-06'
    )
  from public.subscriptions subscription
  where subscription.id = v_subscription_id;
end;
$$;
