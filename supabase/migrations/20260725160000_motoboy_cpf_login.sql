alter table public.delivery_personnel
  add column if not exists cpf text;

create or replace function public.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  total integer;
  remainder integer;
  index_value integer;
begin
  if length(digits) <> 11 or digits ~ '^([0-9])\1{10}$' then
    return false;
  end if;

  total := 0;
  for index_value in 1..9 loop
    total := total + substring(digits from index_value for 1)::integer * (11 - index_value);
  end loop;
  remainder := (total * 10) % 11;
  if remainder = 10 then remainder := 0; end if;
  if remainder <> substring(digits from 10 for 1)::integer then
    return false;
  end if;

  total := 0;
  for index_value in 1..10 loop
    total := total + substring(digits from index_value for 1)::integer * (12 - index_value);
  end loop;
  remainder := (total * 10) % 11;
  if remainder = 10 then remainder := 0; end if;

  return remainder = substring(digits from 11 for 1)::integer;
end;
$$;

update public.delivery_personnel
set cpf = regexp_replace(app_login, '[^0-9]', '', 'g')
where cpf is null
  and app_login is not null
  and public.is_valid_cpf(app_login);

alter table public.delivery_personnel
  drop constraint if exists delivery_personnel_cpf_valid;

alter table public.delivery_personnel
  add constraint delivery_personnel_cpf_valid
  check (cpf is null or public.is_valid_cpf(cpf));

create unique index if not exists delivery_personnel_cpf_unique
  on public.delivery_personnel (cpf)
  where cpf is not null;

create or replace function public.verify_delivery_personnel_login(p_login text, p_password text)
returns table(id uuid, user_id uuid, name text, phone text, vehicle_type text, vehicle_plate text)
language sql
security definer
set search_path = public, extensions
as $$
  select d.id, d.user_id, d.name, d.phone, d.vehicle_type, d.vehicle_plate
  from public.delivery_personnel d
  where (
      d.cpf = regexp_replace(coalesce(p_login, ''), '[^0-9]', '', 'g')
      or (
        d.cpf is null
        and lower(d.app_login) = lower(trim(p_login))
      )
    )
    and d.app_enabled = true
    and d.app_password_hash = crypt(p_password, d.app_password_hash)
  limit 1;
$$;

revoke all on function public.verify_delivery_personnel_login(text, text) from public, anon, authenticated;
grant execute on function public.verify_delivery_personnel_login(text, text) to service_role;
