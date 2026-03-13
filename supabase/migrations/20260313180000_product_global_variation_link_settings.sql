alter table public.product_global_variation_links
  add column if not exists required boolean not null default false,
  add column if not exists min_selections integer not null default 0,
  add column if not exists max_selections integer not null default 1,
  add column if not exists display_order integer not null default 0;

alter table public.product_global_variation_links
  add constraint if not exists product_global_variation_links_min_nonneg check (min_selections >= 0),
  add constraint if not exists product_global_variation_links_max_positive check (max_selections >= 1),
  add constraint if not exists product_global_variation_links_max_gte_min check (max_selections >= min_selections);

