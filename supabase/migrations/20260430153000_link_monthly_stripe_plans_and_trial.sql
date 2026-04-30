-- Link monthly Stripe prices and set the default trial to 14 days.

update public.subscription_plans
set stripe_price_id = 'price_1TJuYXAOHdVi3wt5bNi5P3gH',
    updated_at = now()
where id = 1;

update public.subscription_plans
set stripe_price_id = 'price_1TRzn5AOHdVi3wt5lXOJOcsl',
    updated_at = now()
where id = 2;

update public.subscription_plans
set stripe_price_id = 'price_1TRzqAAOHdVi3wt5Be82uYT4',
    updated_at = now()
where id = 3;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (id) do nothing;

  insert into public.subscriptions (
    user_id,
    status,
    trial_start,
    trial_end,
    created_at,
    updated_at
  )
  values (
    new.id,
    'trialing',
    now(),
    now() + interval '14 days',
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.subscriptions
set trial_end = trial_start + interval '14 days',
    updated_at = now()
where status in ('trial', 'trialing')
  and trial_start is not null
  and trial_end is not null
  and trial_end < trial_start + interval '14 days';
