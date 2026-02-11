alter table public.products
  add column if not exists track_stock boolean not null default false,
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists low_stock_threshold integer not null default 5;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('sale','adjustment','purchase','return')),
  quantity integer not null check (quantity <> 0),
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_user_product_created_idx
  on public.inventory_movements (user_id, product_id, created_at desc);

create unique index if not exists inventory_movements_sale_unique
  on public.inventory_movements (order_id, product_id, type)
  where type = 'sale';

alter table public.inventory_movements enable row level security;

drop policy if exists inventory_movements_owner_select on public.inventory_movements;
create policy inventory_movements_owner_select
  on public.inventory_movements for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists inventory_movements_owner_insert on public.inventory_movements;
create policy inventory_movements_owner_insert
  on public.inventory_movements for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists inventory_movements_owner_update on public.inventory_movements;
create policy inventory_movements_owner_update
  on public.inventory_movements for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists inventory_movements_owner_delete on public.inventory_movements;
create policy inventory_movements_owner_delete
  on public.inventory_movements for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.apply_stock_on_order_preparing()
returns trigger
language plpgsql
security definer
as $$
declare
  item jsonb;
  pid uuid;
  qty integer;
  inserted_id uuid;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status <> 'preparing' or old.status = 'preparing' then
    return new;
  end if;

  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  for item in select * from jsonb_array_elements(new.items)
  loop
    pid := nullif(item->>'product_id','')::uuid;
    qty := greatest(coalesce(nullif(item->>'quantity','')::int, 0), 0);
    if pid is null or qty <= 0 then
      continue;
    end if;

    insert into public.inventory_movements (user_id, product_id, order_id, type, quantity)
    values (new.user_id, pid, new.id, 'sale', -qty)
    on conflict do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update public.products
      set stock_quantity = greatest(stock_quantity - qty, 0)
      where id = pid
        and user_id = new.user_id
        and track_stock = true;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trigger_apply_stock_on_order_preparing on public.orders;
create trigger trigger_apply_stock_on_order_preparing
  after update of status on public.orders
  for each row
  execute function public.apply_stock_on_order_preparing();

