alter table public.product_global_variation_links
  add column if not exists display_order integer;

update public.product_global_variation_links
set display_order = 0
where display_order is null;

alter table public.product_global_variation_links
  alter column display_order set default 0;

create index if not exists idx_pgv_links_product_display_order
  on public.product_global_variation_links (product_id, display_order);

alter table public.products
  add column if not exists cost_price decimal(10,2);

alter table public.products
  add column if not exists packaging_fee decimal(10,2);

alter table public.products
  add column if not exists sku text;
