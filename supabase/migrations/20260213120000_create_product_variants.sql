create table if not exists public.product_variants (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  name text not null,
  price numeric(10,2) not null default 0,
  promotional_price numeric(10,2),
  display_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.product_variants enable row level security;

create policy "Users can view their own product variants"
  on public.product_variants for select
  using (exists (
    select 1 from public.products
    where products.id = product_variants.product_id
    and products.user_id = auth.uid()
  ));

create policy "Users can insert their own product variants"
  on public.product_variants for insert
  with check (exists (
    select 1 from public.products
    where products.id = product_variants.product_id
    and products.user_id = auth.uid()
  ));

create policy "Users can update their own product variants"
  on public.product_variants for update
  using (exists (
    select 1 from public.products
    where products.id = product_variants.product_id
    and products.user_id = auth.uid()
  ));

create policy "Users can delete their own product variants"
  on public.product_variants for delete
  using (exists (
    select 1 from public.products
    where products.id = product_variants.product_id
    and products.user_id = auth.uid()
  ));
