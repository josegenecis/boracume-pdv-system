create or replace function public.apply_product_stock_on_order_sale()
returns trigger
language plpgsql
security definer
as $$
declare
  movement record;
  inserted_id uuid;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, '') not in ('preparing', 'ready', 'in_delivery', 'delivered', 'completed') then
      return new;
    end if;
  elsif tg_op = 'UPDATE' then
    if coalesce(new.status, '') not in ('preparing', 'ready', 'in_delivery', 'delivered', 'completed')
       or coalesce(old.status, '') in ('preparing', 'ready', 'in_delivery', 'delivered', 'completed') then
      return new;
    end if;
  else
    return new;
  end if;

  for movement in
    select
      parsed.product_id,
      sum(parsed.quantity)::integer as quantity
    from (
      select
        nullif(coalesce(item->>'product_id', item->>'id'), '')::uuid as product_id,
        greatest(coalesce(nullif(item->>'quantity', '')::numeric, 0), 0)::integer as quantity
      from jsonb_array_elements(new.items) as item
      where coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) parsed
    join public.products product
      on product.id = parsed.product_id
     and product.user_id = new.user_id
     and product.track_stock = true
    where parsed.quantity > 0
    group by parsed.product_id
  loop
    inserted_id := null;

    insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
    values (new.user_id, movement.product_id, new.id, 'sale', -movement.quantity)
    on conflict do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update public.products
      set
        stock_quantity = greatest(coalesce(stock_quantity, 0) - movement.quantity, 0),
        available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else available end,
        is_available = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else is_available end,
        show_in_delivery = case when greatest(coalesce(stock_quantity, 0) - movement.quantity, 0) <= 0 then false else show_in_delivery end
      where id = movement.product_id
        and user_id = new.user_id
        and track_stock = true;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trigger_apply_stock_on_order_preparing on public.orders;
drop trigger if exists trigger_apply_product_stock_on_order_sale on public.orders;

create trigger trigger_apply_product_stock_on_order_sale
  after insert or update of status on public.orders
  for each row
  execute function public.apply_product_stock_on_order_sale();

