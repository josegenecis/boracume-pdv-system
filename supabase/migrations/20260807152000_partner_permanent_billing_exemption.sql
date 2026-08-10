-- Permanent access requested for a PopSystem partner.
-- Billing exemption is the canonical permanent-access mechanism and takes
-- precedence over trial and paid-period expiration in the access guard.
do $$
declare
  v_email constant text := 'jmcheng122@gmail.com';
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
    raise exception 'Subscription not found for partner account %.', v_email;
  end if;

  update public.subscriptions
  set billing_exempt = true,
      access_override_until = null,
      access_override_granted_by = 'manual_support:partner_permanent_access',
      updated_at = now()
  where id = v_subscription_id;

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
    'manual_support:partner_permanent_access',
    null,
    jsonb_build_object(
      'billing_exempt', true,
      'reason', 'company_partner',
      'email', v_email,
      'permanent', true
    )
  );

  if not exists (
    select 1
    from public.subscriptions subscription
    where subscription.id = v_subscription_id
      and subscription.billing_exempt = true
  ) then
    raise exception 'Permanent billing exemption was not persisted for %.', v_email;
  end if;
end;
$$;
