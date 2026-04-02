alter table public.product_global_variation_links
  add column if not exists pricing_mode text not null default 'default',
  add column if not exists price_multiplier numeric(10,4) not null default 1,
  add column if not exists fixed_option_price numeric(10,2),
  add column if not exists option_price_overrides jsonb not null default '{}'::jsonb;

update public.product_global_variation_links
set pricing_mode = 'default'
where pricing_mode is null or pricing_mode not in ('default', 'free', 'half', 'multiplier', 'fixed');

update public.product_global_variation_links
set price_multiplier = 1
where price_multiplier is null or price_multiplier < 0;

alter table public.product_global_variation_links
  add constraint product_global_variation_links_pricing_mode_check
  check (pricing_mode in ('default', 'free', 'half', 'multiplier', 'fixed'));

alter table public.product_global_variation_links
  add constraint product_global_variation_links_price_multiplier_check
  check (price_multiplier >= 0);

alter table public.product_global_variation_links
  add constraint product_global_variation_links_fixed_option_price_check
  check (fixed_option_price is null or fixed_option_price >= 0);
