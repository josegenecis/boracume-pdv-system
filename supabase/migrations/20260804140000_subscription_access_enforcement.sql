-- Professional subscription access enforcement.
-- Trials last 30 days; paid access follows the paid billing period; one
-- temporary 24-hour release is allowed per overdue period.

alter table public.subscriptions
  add column if not exists billing_exempt boolean not null default false,
  add column if not exists access_override_until timestamptz,
  add column if not exists access_override_granted_at timestamptz,
  add column if not exists access_override_granted_for_period_end timestamptz,
  add column if not exists access_override_granted_by text;

create table if not exists public.subscription_access_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in (
    'temporary_release',
    'payment_confirmed',
    'due_date_scheduled',
    'billing_exemption_changed'
  )),
  actor text,
  period_end timestamptz,
  access_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_access_events_user_created_idx
  on public.subscription_access_events (user_id, created_at desc);

alter table public.subscription_access_events enable row level security;
revoke all on table public.subscription_access_events from anon, authenticated;
grant all on table public.subscription_access_events to service_role;

create or replace function public.get_my_subscription_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_billing_owner_id uuid;
  v_subscription public.subscriptions%rowtype;
  v_status text;
  v_allowed boolean := false;
  v_reason text := 'subscription_missing';
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  select coalesce(
    (
      select network.owner_user_id
      from public.store_network_stores store
      join public.store_networks network on network.id = store.network_id
      where store.store_user_id = v_user_id and store.status = 'active'
      limit 1
    ),
    v_user_id
  ) into v_billing_owner_id;

  select subscription.*
    into v_subscription
  from public.subscriptions subscription
  where subscription.user_id = v_billing_owner_id
  order by subscription.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'subscription_missing',
      'billing_owner_id', v_billing_owner_id
    );
  end if;

  v_status := lower(coalesce(v_subscription.status, ''));

  if v_subscription.billing_exempt then
    v_allowed := true;
    v_reason := 'billing_exempt';
  elsif v_subscription.access_override_until is not null
    and v_subscription.access_override_until > now() then
    v_allowed := true;
    v_reason := 'temporary_release';
  elsif v_status in ('trial', 'trialing', 'teste')
    and v_subscription.trial_end is not null
    and v_subscription.trial_end > now() then
    v_allowed := true;
    v_reason := 'trial';
  elsif v_status in ('active', 'paid', 'trialing_paid', 'current')
    and v_subscription.current_period_end is not null
    and v_subscription.current_period_end > now() then
    v_allowed := true;
    v_reason := 'paid';
  elsif v_status in ('trial', 'trialing', 'teste') then
    v_reason := 'trial_expired';
  elsif v_status in ('past_due', 'unpaid', 'overdue', 'inadimplente', 'blocked', 'suspended') then
    v_reason := 'payment_overdue';
  elsif v_status in ('pending', 'awaiting_payment', 'payment_pending') then
    v_reason := 'payment_pending';
  elsif v_status in ('canceled', 'cancelled', 'expired', 'inactive') then
    v_reason := 'subscription_inactive';
  else
    v_reason := 'period_expired';
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'subscription_id', v_subscription.id,
    'billing_owner_id', v_billing_owner_id,
    'status', v_subscription.status,
    'trial_end', v_subscription.trial_end,
    'current_period_end', v_subscription.current_period_end,
    'access_override_until', v_subscription.access_override_until
  );
end;
$$;

revoke all on function public.get_my_subscription_access_state() from public, anon;
grant execute on function public.get_my_subscription_access_state() to authenticated;

create or replace function public.record_subscription_payment_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'active'
    and new.current_period_end is not null
    and new.current_period_end > now()
    and (
      old.current_period_end is distinct from new.current_period_end
      or lower(coalesce(old.status, '')) is distinct from 'active'
    ) then
    new.access_override_until := null;
    insert into public.subscription_access_events (
      subscription_id, user_id, event_type, actor, period_end, metadata
    ) values (
      new.id,
      new.user_id,
      'payment_confirmed',
      'billing_provider',
      new.current_period_end,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_record_payment_access on public.subscriptions;
create trigger subscriptions_record_payment_access
  before update on public.subscriptions
  for each row execute function public.record_subscription_payment_access();

-- New accounts receive the official 30-day trial.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_email text;
  profile_restaurant_name text;
begin
  profile_email := new.email;
  profile_restaurant_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'restaurant_name', ''),
    nullif(new.raw_user_meta_data ->> 'restaurantName', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Restaurante'
  );

  begin
    insert into public.profiles (id, email, restaurant_name, created_at, updated_at)
    values (new.id, profile_email, profile_restaurant_name, now(), now())
    on conflict (id) do update
      set email = coalesce(public.profiles.email, excluded.email),
          restaurant_name = coalesce(nullif(public.profiles.restaurant_name, ''), excluded.restaurant_name),
          updated_at = now();
  exception
    when undefined_column then
      insert into public.profiles (id, created_at, updated_at)
      values (new.id, now(), now())
      on conflict (id) do nothing;
    when others then
      raise warning 'handle_new_user profile provisioning failed for user %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.subscriptions (
      user_id, plan_id, status, trial_start, trial_end, created_at, updated_at
    )
    select new.id, 1, 'trial', now(), now() + interval '30 days', now(), now()
    where not exists (select 1 from public.subscriptions where user_id = new.id);
  exception
    when foreign_key_violation then
      insert into public.subscriptions (
        user_id, status, trial_start, trial_end, created_at, updated_at
      )
      select new.id, 'trial', now(), now() + interval '30 days', now(), now()
      where not exists (select 1 from public.subscriptions where user_id = new.id);
    when undefined_column then
      raise warning 'handle_new_user subscription schema is missing expected columns for user %: %', new.id, sqlerrm;
    when others then
      raise warning 'handle_new_user subscription provisioning failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the initial profile and an official 30-day trial subscription for new users.';

-- Schedule the two explicitly requested accounts. Only an unambiguous name
-- match is changed; ambiguous matches are deliberately left untouched.
do $$
declare
  v_user_id uuid;
  v_match_count integer;
begin
  select count(*), (array_agg(id))[1]
    into v_match_count, v_user_id
  from public.profiles
  where restaurant_name ilike '%Alta Variedade%';

  if v_match_count = 1 then
    update public.subscriptions
      set status = 'trial',
          trial_end = timestamptz '2026-08-05 00:00:00-03',
          updated_at = now()
    where user_id = v_user_id;
    insert into public.subscription_access_events (subscription_id, user_id, event_type, actor, period_end)
      select id, user_id, 'due_date_scheduled', 'migration:20260804140000', trial_end
      from public.subscriptions where user_id = v_user_id order by updated_at desc limit 1;
  else
    raise notice 'Alta Variedade was not changed because % matching profiles were found.', v_match_count;
  end if;

  select count(*), (array_agg(id))[1]
    into v_match_count, v_user_id
  from public.profiles
  where restaurant_name ilike '%The Place%Aça%'
     or restaurant_name ilike '%The Place%Acai%'
     or lower(trim(restaurant_name)) = 'the place';

  if v_match_count = 1 then
    update public.subscriptions
      set status = 'trial',
          trial_end = timestamptz '2026-08-16 00:00:00-03',
          updated_at = now()
    where user_id = v_user_id;
    insert into public.subscription_access_events (subscription_id, user_id, event_type, actor, period_end)
      select id, user_id, 'due_date_scheduled', 'migration:20260804140000', trial_end
      from public.subscriptions where user_id = v_user_id order by updated_at desc limit 1;
  else
    raise notice 'The Place Acai was not changed because % matching profiles were found.', v_match_count;
  end if;
end;
$$;

-- Existing trials older than three months become due immediately. Paid
-- subscriptions are intentionally excluded from this migration.
with overdue_trials as (
  select distinct on (subscription.user_id) subscription.id
  from public.subscriptions subscription
  join public.profiles profile on profile.id = subscription.user_id
  where lower(subscription.status) in ('trial', 'trialing', 'teste')
    and profile.created_at <= now() - interval '3 months'
  order by subscription.user_id, subscription.updated_at desc
)
update public.subscriptions subscription
set trial_end = least(coalesce(subscription.trial_end, now()), now()),
    updated_at = now()
from overdue_trials
where subscription.id = overdue_trials.id
  and subscription.user_id not in (
    select id from public.profiles
    where restaurant_name ilike '%Alta Variedade%'
       or restaurant_name ilike '%The Place%Aça%'
       or restaurant_name ilike '%The Place%Acai%'
       or lower(trim(restaurant_name)) = 'the place'
  );
