-- Create Loyalty Programs Table (Rules)
create table if not exists public.loyalty_programs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('points', 'visits', 'spending', 'shipping')),
  goal_value numeric(10,2) not null default 0,
  reward_type text not null check (reward_type in ('percent', 'fixed_amount', 'free_product', 'free_shipping')),
  reward_value numeric(10,2) not null default 0,
  active boolean default true,
  notify_whatsapp boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Coupons Table
create table if not exists public.coupons (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed', 'shipping')),
  discount_value numeric(10,2) not null default 0,
  min_purchase numeric(10,2) default 0,
  active boolean default true,
  usage_limit integer, -- Optional: limit total uses
  usage_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, code)
);

-- Create Customer Loyalty Balances (to track progress)
create table if not exists public.customer_loyalty_balances (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null, -- The restaurant owner
  customer_phone text not null, -- Identify customer by phone (simple CRM)
  customer_name text,
  total_points numeric(10,2) default 0,
  total_visits integer default 0,
  total_spent numeric(10,2) default 0,
  last_order_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, customer_phone)
);

-- Enable RLS
alter table public.loyalty_programs enable row level security;
alter table public.coupons enable row level security;
alter table public.customer_loyalty_balances enable row level security;

-- Policies for Loyalty Programs
create policy "Users can manage their own loyalty programs"
  on public.loyalty_programs for all
  using (auth.uid() = user_id);

-- Policies for Coupons
create policy "Users can manage their own coupons"
  on public.coupons for all
  using (auth.uid() = user_id);

-- Policies for Customer Balances
create policy "Users can manage their customer balances"
  on public.customer_loyalty_balances for all
  using (auth.uid() = user_id);
