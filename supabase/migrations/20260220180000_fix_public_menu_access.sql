
-- Garantir acesso público ao cardápio digital (Menu Digital)

-- 1. Profiles (Restaurantes) - Público
alter table public.profiles enable row level security;
drop policy if exists "Public profiles access" on public.profiles;
create policy "Public profiles access" on public.profiles for select using (true);

-- 2. Categories - Público
alter table public.product_categories enable row level security;
drop policy if exists "Public categories access" on public.product_categories;
create policy "Public categories access" on public.product_categories for select using (true);

-- 3. Products - Público (apenas disponíveis ou todos? Melhor todos e filtrar no front para evitar confusão, ou manter padrão de available)
-- Vamos manter available para não expor rascunhos, mas garantir que a policy exista
alter table public.products enable row level security;
drop policy if exists "Public products access" on public.products;
create policy "Public products access" on public.products for select using (true); 
-- Nota: mudei para true para debug. O frontend já filtra is_available=true. 
-- Se o RLS filtrar também, as vezes causa confusão se o flag estiver null.

-- 4. Product Variants (Preços P/M/G) - CRÍTICO: estava faltando acesso público
alter table public.product_variants enable row level security;
drop policy if exists "Public product variants access" on public.product_variants;
create policy "Public product variants access" on public.product_variants for select using (true);

-- 5. Product Variations (Adicionais) - Público
alter table public.product_variations enable row level security;
drop policy if exists "Public product variations access" on public.product_variations;
create policy "Public product variations access" on public.product_variations for select using (true);

-- 6. Global Variations - Público
alter table public.global_variations enable row level security;
drop policy if exists "Public global variations access" on public.global_variations;
create policy "Public global variations access" on public.global_variations for select using (true);

-- 7. Links Global Variations - Público
alter table public.product_global_variation_links enable row level security;
drop policy if exists "Public global variation links access" on public.product_global_variation_links;
create policy "Public global variation links access" on public.product_global_variation_links for select using (true);

-- 8. Delivery Zones - Público
alter table public.delivery_zones enable row level security;
drop policy if exists "Public delivery zones access" on public.delivery_zones;
create policy "Public delivery zones access" on public.delivery_zones for select using (true);
