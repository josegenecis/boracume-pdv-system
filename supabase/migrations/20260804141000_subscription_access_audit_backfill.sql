-- Backfill the audit trail for legacy trials made due by the enforcement
-- migration and assert the two explicitly scheduled accounts.

insert into public.subscription_access_events (
  subscription_id,
  user_id,
  event_type,
  actor,
  period_end,
  metadata
)
select
  subscription.id,
  subscription.user_id,
  'due_date_scheduled',
  'migration:20260804141000',
  subscription.trial_end,
  jsonb_build_object('policy', 'legacy_trial_over_3_months')
from public.subscriptions subscription
join public.profiles profile on profile.id = subscription.user_id
where lower(subscription.status) in ('trial', 'trialing', 'teste')
  and profile.created_at <= now() - interval '3 months'
  and subscription.trial_end <= now()
  and not exists (
    select 1
    from public.subscription_access_events event
    where event.subscription_id = subscription.id
      and event.event_type = 'due_date_scheduled'
  );

do $$
declare
  v_alta_count integer;
  v_place_count integer;
begin
  select count(*) into v_alta_count
  from public.profiles profile
  join public.subscriptions subscription on subscription.user_id = profile.id
  where profile.restaurant_name ilike '%Alta Variedade%'
    and subscription.status = 'trial'
    and subscription.trial_end = timestamptz '2026-08-05 00:00:00-03';

  select count(*) into v_place_count
  from public.profiles profile
  join public.subscriptions subscription on subscription.user_id = profile.id
  where (
      profile.restaurant_name ilike '%The Place%Aça%'
      or profile.restaurant_name ilike '%The Place%Acai%'
      or lower(trim(profile.restaurant_name)) = 'the place'
    )
    and subscription.status = 'trial'
    and subscription.trial_end = timestamptz '2026-08-16 00:00:00-03';

  if v_alta_count <> 1 then
    raise exception 'Expected exactly one scheduled Alta Variedade subscription, found %.', v_alta_count;
  end if;
  if v_place_count <> 1 then
    raise exception 'Expected exactly one scheduled The Place Acai subscription, found %.', v_place_count;
  end if;

  raise notice 'Billing schedule verified: Alta Variedade=%, The Place Acai=%.', v_alta_count, v_place_count;
end;
$$;
