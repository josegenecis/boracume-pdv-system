-- Fix signup failures caused by onboarding trigger errors.
--
-- Supabase Auth aborts user creation when an AFTER INSERT trigger on
-- auth.users raises an exception. The previous version used
-- ON CONFLICT (user_id) on subscriptions, which fails if the production
-- database does not have a unique/exclusion constraint for that target.

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
    insert into public.profiles (
      id,
      email,
      restaurant_name,
      created_at,
      updated_at
    )
    values (
      new.id,
      profile_email,
      profile_restaurant_name,
      now(),
      now()
    )
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
      user_id,
      plan_id,
      status,
      trial_start,
      trial_end,
      created_at,
      updated_at
    )
    select
      new.id,
      1,
      'trial',
      now(),
      now() + interval '14 days',
      now(),
      now()
    where not exists (
      select 1
      from public.subscriptions
      where user_id = new.id
    );
  exception
    when foreign_key_violation then
      insert into public.subscriptions (
        user_id,
        status,
        trial_start,
        trial_end,
        created_at,
        updated_at
      )
      select
        new.id,
        'trial',
        now(),
        now() + interval '14 days',
        now(),
        now()
      where not exists (
        select 1
        from public.subscriptions
        where user_id = new.id
      );
    when undefined_column then
      raise warning 'handle_new_user subscription schema is missing expected columns for user %: %', new.id, sqlerrm;
    when others then
      raise warning 'handle_new_user subscription provisioning failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates the initial profile/subscription for new auth users without aborting signup on secondary provisioning errors.';
