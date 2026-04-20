alter table public.waiters
  add column if not exists email text,
  add column if not exists password text,
  add column if not exists cpf text,
  add column if not exists role text default 'cashier',
  add column if not exists permissions jsonb default '{}'::jsonb;

update public.waiters
set role = 'cashier'
where role is null or role = '';

update public.waiters
set permissions = '{}'::jsonb
where permissions is null;

alter table public.waiters
  alter column role set default 'cashier',
  alter column role set not null,
  alter column permissions set default '{}'::jsonb,
  alter column permissions set not null;

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

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_waiters_user_cpf_unique'
  ) then
    begin
      execute 'create unique index idx_waiters_user_cpf_unique on public.waiters (user_id, cpf) where cpf is not null';
    exception
      when unique_violation then
        raise notice 'Nao foi possivel criar idx_waiters_user_cpf_unique porque ja existem CPFs duplicados.';
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
