-- Public read policies for digital menu
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.product_variations enable row level security;
alter table public.product_global_variation_links enable row level security;
alter table public.global_variations enable row level security;
alter table public.profiles enable row level security;

-- Products: allow anonymous SELECT where is_available and show_in_delivery
create policy products_public_read on public.products
  for select using (is_available = true and show_in_delivery = true);

-- Categories: allow anonymous SELECT
create policy product_categories_public_read on public.product_categories
  for select using (true);

-- Delivery zones: allow anonymous SELECT of active
create policy delivery_zones_public_read on public.delivery_zones
  for select using (active = true);

-- Product variations (specific): allow anonymous SELECT
create policy product_variations_public_read on public.product_variations
  for select using (true);

-- Global variation links: allow anonymous SELECT
create policy product_global_variation_links_public_read on public.product_global_variation_links
  for select using (true);

-- Global variations: allow anonymous SELECT
create policy global_variations_public_read on public.global_variations
  for select using (true);

-- Profiles: allow anonymous SELECT limited
create policy profiles_public_read on public.profiles
  for select using (true);

-- Push subscriptions table and policies
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy push_subscriptions_select on public.push_subscriptions
  for select using (auth.uid() = user_id);

