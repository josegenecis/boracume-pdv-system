alter table public.waiters
  add column if not exists role text not null default 'cashier',
  add column if not exists permissions jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'waiters_role_check'
  ) then
    alter table public.waiters
      add constraint waiters_role_check
      check (role in ('admin', 'cashier'));
  end if;
end $$;

