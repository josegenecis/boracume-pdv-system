-- Toda loja que possui administrador deve conservar ao menos um administrador ativo.
-- Também repara o administrador Igor da conta informada pelo proprietário.

update public.waiters set active = true where active is null;

alter table public.waiters
  alter column active set default true,
  alter column active set not null;

do $$
declare
  v_owner_id uuid;
  v_owner_count integer;
  v_igor_id uuid;
  v_igor_count integer;
begin
  select count(*), (array_agg(id))[1]
    into v_owner_count, v_owner_id
  from auth.users
  where lower(email) = lower('amnaraujo78@gmail.com');

  if v_owner_count <> 1 then
    raise exception 'Conta amnaraujo78@gmail.com não encontrada de forma única (encontradas: %).', v_owner_count;
  end if;

  select count(*), (array_agg(id))[1]
    into v_igor_count, v_igor_id
  from public.waiters
  where user_id = v_owner_id and lower(trim(name)) = 'igor';

  if v_igor_count = 0 then
    select count(*), (array_agg(id))[1]
      into v_igor_count, v_igor_id
    from public.waiters
    where user_id = v_owner_id and name ilike '%igor%';
  end if;

  if v_igor_count <> 1 then
    raise exception 'Não foi possível identificar um único Igor na conta amnaraujo78@gmail.com (encontrados: %).', v_igor_count;
  end if;

  update public.waiters
  set active = true,
      role = 'admin',
      permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object(
        'admin', true,
        'dashboard_view', true,
        'pos_access', true,
        'tables_access', true,
        'pos_discount', true,
        'pos_cancel_item', true,
        'pos_open_close', true,
        'cash_movement', true,
        'orders_manage', true,
        'kds_access', true,
        'menu_manage', true,
        'stock_manage', true,
        'delivery_manage', true,
        'financial_view', true,
        'reports_view', true,
        'marketing_manage', true,
        'fiscal_manage', true,
        'users_manage', true,
        'settings_manage', true
      )
  where id = v_igor_id;
end $$;

create or replace function public.protect_last_active_waiter_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_active_admin boolean;
  v_will_be_active_admin boolean;
  v_other_admins integer;
begin
  v_was_active_admin := old.active = true
    and (old.role = 'admin' or coalesce(old.permissions, '{}'::jsonb) @> '{"admin": true}'::jsonb);

  if tg_op = 'DELETE' then
    v_will_be_active_admin := false;
  else
    v_will_be_active_admin := new.active = true
      and (new.role = 'admin' or coalesce(new.permissions, '{}'::jsonb) @> '{"admin": true}'::jsonb)
      and new.user_id = old.user_id;
  end if;

  if v_was_active_admin and not v_will_be_active_admin then
    select count(*) into v_other_admins
    from public.waiters waiter
    where waiter.user_id = old.user_id
      and waiter.id <> old.id
      and waiter.active = true
      and (waiter.role = 'admin' or coalesce(waiter.permissions, '{}'::jsonb) @> '{"admin": true}'::jsonb);

    if v_other_admins = 0 then
      raise exception 'A loja deve possuir pelo menos um administrador ativo. Crie ou ative outro administrador antes desta alteração.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_last_active_waiter_admin_trigger on public.waiters;
create trigger protect_last_active_waiter_admin_trigger
  before update of active, role, permissions, user_id or delete
  on public.waiters
  for each row execute function public.protect_last_active_waiter_admin();

notify pgrst, 'reload schema';
