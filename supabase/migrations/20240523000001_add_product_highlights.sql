alter table public.products add column if not exists is_highlight boolean default false;
alter table public.products add column if not exists order_count integer default 0;
alter table public.products add column if not exists original_price decimal(10,2);
alter table public.products add column if not exists discount_percentage decimal(5,2);

create index if not exists idx_products_highlights on public.products(user_id, is_highlight) where is_highlight = true;
create index if not exists idx_products_order_count on public.products(user_id, order_count desc);
