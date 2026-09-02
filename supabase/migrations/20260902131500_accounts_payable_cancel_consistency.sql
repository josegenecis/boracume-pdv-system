-- Mantém cancelamentos fora dos totais legados que ainda filtram por is_active,
-- sem apagar a obrigação nem seu histórico.
create or replace function public.sync_cancelled_payable_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    new.is_active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_sync_cancelled_activity on public.expenses;
create trigger expenses_sync_cancelled_activity
before insert or update of status on public.expenses
for each row execute function public.sync_cancelled_payable_activity();

update public.expenses
set is_active = false
where status = 'cancelled' and is_active is distinct from false;
