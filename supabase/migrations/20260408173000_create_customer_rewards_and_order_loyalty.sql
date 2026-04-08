alter table if exists public.orders
add column if not exists loyalty_processed_at timestamp with time zone;

create table if not exists public.customer_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  program_id uuid references public.loyalty_programs(id) on delete cascade not null,
  customer_phone text not null,
  customer_name text,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed', 'shipping', 'free_shipping')),
  discount_value numeric(10,2) not null default 0,
  status text not null default 'available' check (status in ('available', 'used', 'expired')),
  awarded_at timestamp with time zone not null default now(),
  used_at timestamp with time zone,
  order_id uuid references public.orders(id) on delete set null
);

create index if not exists idx_customer_rewards_lookup
on public.customer_rewards(user_id, customer_phone, status, awarded_at);

alter table public.customer_rewards enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_rewards'
      and policyname = 'Users can manage their own customer rewards'
  ) then
    create policy "Users can manage their own customer rewards"
      on public.customer_rewards
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
