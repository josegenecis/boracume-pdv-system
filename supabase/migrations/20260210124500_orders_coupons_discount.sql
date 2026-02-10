alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount numeric(12,2) not null default 0;

