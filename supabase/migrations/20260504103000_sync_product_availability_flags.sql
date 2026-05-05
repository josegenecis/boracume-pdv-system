alter table public.products
  add column if not exists available boolean default true,
  add column if not exists is_available boolean default true;

update public.products
set
  available = coalesce(available, is_available, true),
  is_available = coalesce(is_available, available, true)
where available is null
   or is_available is null
   or available is distinct from is_available;

create or replace function public.sync_product_availability_flags()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.available := coalesce(new.available, new.is_available, true);
    new.is_available := coalesce(new.is_available, new.available, true);
    return new;
  end if;

  if new.available is distinct from old.available then
    new.is_available := new.available;
  elsif new.is_available is distinct from old.is_available then
    new.available := new.is_available;
  else
    new.available := coalesce(new.available, true);
    new.is_available := coalesce(new.is_available, new.available, true);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_product_availability_flags on public.products;
create trigger trg_sync_product_availability_flags
before insert or update on public.products
for each row
execute function public.sync_product_availability_flags();

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'Public products are viewable for digital menu'
  ) then
    drop policy "Public products are viewable for digital menu" on public.products;
  end if;
end
$$;

create policy "Public products are viewable for digital menu"
on public.products
for select
using (show_in_delivery = true and coalesce(is_available, available, true) = true);
