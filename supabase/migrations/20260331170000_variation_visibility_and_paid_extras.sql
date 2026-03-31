alter table public.global_variations
  add column if not exists active boolean not null default true;

alter table public.product_variations
  add column if not exists active boolean not null default true,
  add column if not exists free_selections_limit integer not null default 0,
  add column if not exists allow_paid_excess boolean not null default false,
  add column if not exists paid_max_selections integer;

alter table public.product_global_variation_links
  add column if not exists free_selections_limit integer not null default 0,
  add column if not exists allow_paid_excess boolean not null default false,
  add column if not exists paid_max_selections integer;
