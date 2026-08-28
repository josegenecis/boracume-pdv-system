-- Acesso interno permanente para a conta oficial de testes do PopSystem.
do $$
declare
  v_email constant text := 'teste02@gmail.com';
  v_user_id uuid;
  v_subscription_id uuid;
  v_user_count integer;
begin
  select count(*), (array_agg(users.id))[1]
    into v_user_count, v_user_id
  from auth.users users
  where lower(trim(users.email)) = v_email;

  if v_user_count <> 1 then
    raise exception 'Expected exactly one account for %, found %.', v_email, v_user_count;
  end if;

  select subscription.id
    into v_subscription_id
  from public.subscriptions subscription
  where subscription.user_id = v_user_id
  order by subscription.updated_at desc, subscription.created_at desc
  limit 1
  for update;

  if v_subscription_id is null then
    insert into public.subscriptions (
      user_id,
      plan_id,
      status,
      billing_exempt,
      store_count,
      additional_store_count,
      access_override_until,
      access_override_granted_by,
      created_at,
      updated_at
    ) values (
      v_user_id,
      3,
      'active',
      true,
      1,
      0,
      null,
      'manual_support:official_test_account',
      now(),
      now()
    )
    returning id into v_subscription_id;
  else
    update public.subscriptions
    set plan_id = 3,
        status = 'active',
        billing_exempt = true,
        store_count = greatest(coalesce(store_count, 1), 1),
        additional_store_count = greatest(coalesce(store_count, 1) - 1, 0),
        access_override_until = null,
        access_override_granted_by = 'manual_support:official_test_account',
        updated_at = now()
    where id = v_subscription_id;
  end if;

  insert into public.subscription_access_events (
    subscription_id,
    user_id,
    event_type,
    actor,
    period_end,
    metadata
  ) values (
    v_subscription_id,
    v_user_id,
    'billing_exemption_changed',
    'manual_support:official_test_account',
    null,
    jsonb_build_object(
      'billing_exempt', true,
      'plan_id', 3,
      'plan_slug', 'multi',
      'reason', 'official_internal_test_account',
      'email', v_email,
      'permanent', true,
      'unlimited', true
    )
  );

  if not exists (
    select 1
    from public.subscriptions subscription
    where subscription.id = v_subscription_id
      and subscription.user_id = v_user_id
      and subscription.plan_id = 3
      and subscription.status = 'active'
      and subscription.billing_exempt = true
  ) then
    raise exception 'Unlimited Multi access was not persisted for %.', v_email;
  end if;
end;
$$;
