create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  business_id text,
  ad_account_id text,
  page_id text,
  instagram_account_id text,
  whatsapp_business_account_id text,
  phone_number_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  status text not null default 'disconnected' check (status in ('disconnected','connected','expired','error','revoked')),
  permissions jsonb not null default '[]'::jsonb,
  assets_json jsonb not null default '{}'::jsonb,
  currency text,
  timezone text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.meta_connections(id) on delete set null,
  meta_campaign_id text,
  name text not null,
  objective text not null default 'OUTCOME_ENGAGEMENT',
  destination text not null default 'whatsapp' check (destination in ('whatsapp','menu','site')),
  daily_budget numeric(10,2) not null default 10,
  status text not null default 'draft' check (status in ('draft','review','approved','publishing','paused','active','completed','error','archived')),
  start_date date,
  end_date date,
  target_city text,
  target_radius_km numeric(6,2),
  product_focus text,
  product_id uuid references public.products(id) on delete set null,
  menu_link text,
  ai_strategy jsonb not null default '{}'::jsonb,
  review_snapshot jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_adsets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  meta_adset_id text,
  audience_json jsonb not null default '{}'::jsonb,
  placement_json jsonb not null default '{}'::jsonb,
  budget numeric(10,2),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  format text not null,
  type text not null default 'static',
  image_url text,
  video_url text,
  headline text,
  primary_text text,
  description text,
  cta text not null default 'LEARN_MORE',
  meta_creative_id text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_ads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  adset_id uuid references public.marketing_adsets(id) on delete cascade,
  creative_id uuid references public.marketing_creatives(id) on delete set null,
  meta_ad_id text,
  status text not null default 'draft',
  performance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  date date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(10,4) not null default 0,
  cpc numeric(10,4) not null default 0,
  cpm numeric(10,4) not null default 0,
  spend numeric(10,2) not null default 0,
  conversations integer not null default 0,
  leads integer not null default 0,
  orders integer not null default 0,
  revenue_estimated numeric(10,2) not null default 0,
  roi_estimated numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, date)
);

create table if not exists public.marketing_ai_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  action text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists meta_connections_restaurant_idx on public.meta_connections(restaurant_id, status);
create index if not exists marketing_campaigns_restaurant_idx on public.marketing_campaigns(restaurant_id, status, created_at desc);
create index if not exists marketing_metrics_campaign_date_idx on public.marketing_metrics(campaign_id, date desc);

alter table public.meta_connections enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_adsets enable row level security;
alter table public.marketing_creatives enable row level security;
alter table public.marketing_ads enable row level security;
alter table public.marketing_metrics enable row level security;
alter table public.marketing_ai_logs enable row level security;

drop policy if exists "Users can manage their own meta connection" on public.meta_connections;
create policy "Users can manage their own meta connection" on public.meta_connections
  for all using (auth.uid() = restaurant_id) with check (auth.uid() = restaurant_id);

drop policy if exists "Users can manage their own marketing campaigns" on public.marketing_campaigns;
create policy "Users can manage their own marketing campaigns" on public.marketing_campaigns
  for all using (auth.uid() = restaurant_id) with check (auth.uid() = restaurant_id);

drop policy if exists "Users can manage their own marketing adsets" on public.marketing_adsets;
create policy "Users can manage their own marketing adsets" on public.marketing_adsets
  for all using (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()))
  with check (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()));

drop policy if exists "Users can manage their own marketing creatives" on public.marketing_creatives;
create policy "Users can manage their own marketing creatives" on public.marketing_creatives
  for all using (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()))
  with check (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()));

drop policy if exists "Users can manage their own marketing ads" on public.marketing_ads;
create policy "Users can manage their own marketing ads" on public.marketing_ads
  for all using (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()))
  with check (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()));

drop policy if exists "Users can view their own marketing metrics" on public.marketing_metrics;
create policy "Users can view their own marketing metrics" on public.marketing_metrics
  for select using (exists (select 1 from public.marketing_campaigns c where c.id = campaign_id and c.restaurant_id = auth.uid()));

drop policy if exists "Users can view their own marketing ai logs" on public.marketing_ai_logs;
create policy "Users can view their own marketing ai logs" on public.marketing_ai_logs
  for select using (auth.uid() = restaurant_id);

drop trigger if exists update_meta_connections_updated_at on public.meta_connections;
create trigger update_meta_connections_updated_at
  before update on public.meta_connections
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_marketing_campaigns_updated_at on public.marketing_campaigns;
create trigger update_marketing_campaigns_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_marketing_adsets_updated_at on public.marketing_adsets;
create trigger update_marketing_adsets_updated_at
  before update on public.marketing_adsets
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_marketing_creatives_updated_at on public.marketing_creatives;
create trigger update_marketing_creatives_updated_at
  before update on public.marketing_creatives
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_marketing_ads_updated_at on public.marketing_ads;
create trigger update_marketing_ads_updated_at
  before update on public.marketing_ads
  for each row execute function public.update_updated_at_column();
