alter table public.promotional_banners
add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists promotional_banners_user_product_idx
on public.promotional_banners (user_id, product_id);

