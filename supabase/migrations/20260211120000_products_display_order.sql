alter table public.products
  add column if not exists display_order integer;

update public.products
set display_order = 0
where display_order is null;

alter table public.products
  alter column display_order set default 0;

create index if not exists products_user_category_display_order_idx
  on public.products (user_id, category_id, display_order);

with ranked as (
  select id,
         row_number() over (partition by user_id, category_id order by created_at asc) - 1 as rn
  from public.products
  where display_order = 0
)
update public.products p
set display_order = r.rn
from ranked r
where p.id = r.id;

