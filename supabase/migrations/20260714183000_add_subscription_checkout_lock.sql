create table if not exists public.subscription_checkout_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_id uuid not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_checkout_locks enable row level security;

revoke all on table public.subscription_checkout_locks from anon, authenticated;

create or replace function public.claim_subscription_checkout(
  p_user_id uuid,
  p_request_id uuid,
  p_lock_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  insert into public.subscription_checkout_locks (
    user_id,
    request_id,
    locked_until,
    updated_at
  )
  values (
    p_user_id,
    p_request_id,
    now() + make_interval(secs => greatest(30, least(p_lock_seconds, 600))),
    now()
  )
  on conflict (user_id) do update
    set request_id = excluded.request_id,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.subscription_checkout_locks.locked_until < now()
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_subscription_checkout(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_subscription_checkout(uuid, uuid, integer) to service_role;

comment on table public.subscription_checkout_locks is
  'Trava curta e atômica que impede duas cobranças de assinatura simultâneas para o mesmo usuário.';
