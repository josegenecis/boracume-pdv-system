alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.product_variations enable row level security;
alter table public.product_global_variation_links enable row level security;
alter table public.global_variations enable row level security;
alter table public.profiles enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (is_available = true and show_in_delivery = true);

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read on public.product_categories
  for select using (true);

drop policy if exists delivery_zones_public_read on public.delivery_zones;
create policy delivery_zones_public_read on public.delivery_zones
  for select using (active = true);

drop policy if exists product_variations_public_read on public.product_variations;
create policy product_variations_public_read on public.product_variations
  for select using (true);

drop policy if exists product_global_variation_links_public_read on public.product_global_variation_links;
create policy product_global_variation_links_public_read on public.product_global_variation_links
  for select using (true);

drop policy if exists global_variations_public_read on public.global_variations;
create policy global_variations_public_read on public.global_variations
  for select using (true);

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select using (true);

