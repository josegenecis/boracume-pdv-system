alter table public.products
  add column if not exists internal_code text;

with existing_maximum as (
  select
    user_id,
    coalesce(
      max(nullif(regexp_replace(internal_code, '[^0-9]', '', 'g'), '')::bigint),
      0
    ) as maximum_number
  from public.products
  where internal_code is not null and btrim(internal_code) <> ''
  group by user_id
),
numbered_products as (
  select
    product.id,
    coalesce(existing.maximum_number, 0) + row_number() over (
      partition by product.user_id
      order by product.created_at nulls last, product.id
    ) as sequence_number
  from public.products as product
  left join existing_maximum as existing on existing.user_id = product.user_id
  where product.internal_code is null or btrim(product.internal_code) = ''
)
update public.products as product
set internal_code = 'P' || lpad(numbered.sequence_number::text, 6, '0')
from numbered_products as numbered
where product.id = numbered.id;

create unique index if not exists products_user_internal_code_uidx
  on public.products (user_id, upper(internal_code))
  where internal_code is not null and btrim(internal_code) <> '';

create or replace function public.assign_product_internal_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_number bigint;
begin
  if new.internal_code is not null and btrim(new.internal_code) <> '' then
    new.internal_code := upper(btrim(new.internal_code));
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('product-internal-code:' || new.user_id::text, 0)
  );

  select coalesce(
    max(
      nullif(regexp_replace(product.internal_code, '[^0-9]', '', 'g'), '')::bigint
    ),
    0
  ) + 1
  into next_number
  from public.products as product
  where product.user_id = new.user_id;

  new.internal_code := 'P' || lpad(next_number::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists products_assign_internal_code on public.products;
create trigger products_assign_internal_code
before insert or update of user_id, internal_code on public.products
for each row
execute function public.assign_product_internal_code();

alter table public.products
  alter column internal_code set not null;

comment on column public.products.internal_code is
  'Codigo interno estavel do produto, usado como cProd nos documentos fiscais. Nao substitui UUID, SKU ou GTIN.';
