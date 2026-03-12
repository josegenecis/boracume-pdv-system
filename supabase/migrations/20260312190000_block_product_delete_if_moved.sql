create or replace function public.prevent_product_delete_if_moved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.inventory_movements im
    where im.product_id = old.id
    limit 1
  ) then
    raise exception 'Não é possível excluir este produto porque já houve movimentação no caixa. Desative o produto em vez de excluir.';
  end if;

  if exists (
    select 1
    from public.nfce_items ni
    where ni.product_id = old.id
    limit 1
  ) then
    raise exception 'Não é possível excluir este produto porque já foi usado em NFC-e. Desative o produto em vez de excluir.';
  end if;

  if exists (
    select 1
    from public.orders o
    where o.user_id = old.user_id
      and jsonb_typeof(o.items) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(o.items) it
        where it ->> 'product_id' = old.id::text
        limit 1
      )
    limit 1
  ) then
    raise exception 'Não é possível excluir este produto porque já existe pedido com ele. Desative o produto em vez de excluir.';
  end if;

  if exists (
    select 1
    from public.table_accounts ta
    where ta.user_id = old.user_id
      and jsonb_typeof(ta.items) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(ta.items) it
        where it ->> 'product_id' = old.id::text
        limit 1
      )
    limit 1
  ) then
    raise exception 'Não é possível excluir este produto porque já existe movimentação em mesa com ele. Desative o produto em vez de excluir.';
  end if;

  if exists (
    select 1
    from public.kitchen_orders ko
    where ko.user_id = old.user_id
      and jsonb_typeof(ko.items) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(ko.items) it
        where it ->> 'product_id' = old.id::text
        limit 1
      )
    limit 1
  ) then
    raise exception 'Não é possível excluir este produto porque já existe pedido na cozinha com ele. Desative o produto em vez de excluir.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_product_delete_if_moved on public.products;
create trigger trg_prevent_product_delete_if_moved
before delete on public.products
for each row
execute function public.prevent_product_delete_if_moved();

