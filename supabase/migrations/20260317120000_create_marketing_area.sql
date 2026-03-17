create table if not exists public.marketing_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  google_tag_id text,
  facebook_pixel_id text,
  banner_images jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id)
);

create table if not exists public.promotional_banners (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  image_url text,
  link_url text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  active boolean default true,
  display_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists promotional_banners_user_active_order_idx
on public.promotional_banners (user_id, active, display_order);

create table if not exists public.upsell_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  trigger_product_id uuid references public.products(id) on delete cascade,
  suggested_product_id uuid references public.products(id) on delete cascade,
  message text,
  active boolean default true,
  display_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists upsell_rules_user_active_order_idx
on public.upsell_rules (user_id, active, display_order);

alter table public.products
add column if not exists highlight_order integer default 0;

update public.products set highlight_order = 0 where highlight_order is null;

create index if not exists products_highlight_order_idx
on public.products (user_id, is_highlight, highlight_order);

alter table public.marketing_settings enable row level security;
alter table public.promotional_banners enable row level security;
alter table public.upsell_rules enable row level security;

drop policy if exists "Public can read marketing settings" on public.marketing_settings;
create policy "Public can read marketing settings"
  on public.marketing_settings for select
  to public
  using (true);

drop policy if exists "Users can manage marketing settings" on public.marketing_settings;
create policy "Users can manage marketing settings"
  on public.marketing_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Anon can read active banners" on public.promotional_banners;
create policy "Anon can read active banners"
  on public.promotional_banners for select
  to anon
  using (
    active = true
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
  );

drop policy if exists "Users can read own banners" on public.promotional_banners;
create policy "Users can read own banners"
  on public.promotional_banners for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own banners" on public.promotional_banners;
create policy "Users can manage own banners"
  on public.promotional_banners for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Anon can read active upsell rules" on public.upsell_rules;
create policy "Anon can read active upsell rules"
  on public.upsell_rules for select
  to anon
  using (active = true);

drop policy if exists "Users can read own upsell rules" on public.upsell_rules;
create policy "Users can read own upsell rules"
  on public.upsell_rules for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own upsell rules" on public.upsell_rules;
create policy "Users can manage own upsell rules"
  on public.upsell_rules for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('promotional-banners', 'promotional-banners', true)
on conflict (id) do nothing;

drop policy if exists "Public read promotional banners" on storage.objects;
create policy "Public read promotional banners"
on storage.objects for select
to public
using (bucket_id = 'promotional-banners');

drop policy if exists "Authenticated users can upload promotional banners" on storage.objects;
create policy "Authenticated users can upload promotional banners"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'promotional-banners'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Authenticated users can update promotional banners" on storage.objects;
create policy "Authenticated users can update promotional banners"
on storage.objects for update
to authenticated
using (
  bucket_id = 'promotional-banners'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'promotional-banners'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Authenticated users can delete promotional banners" on storage.objects;
create policy "Authenticated users can delete promotional banners"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'promotional-banners'
  and split_part(name, '/', 1) = auth.uid()::text
);

