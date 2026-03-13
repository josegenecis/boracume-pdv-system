alter table public.subscription_plans
add column if not exists stripe_price_id text;

update public.subscription_plans
set stripe_price_id = 'price_1TAWvVPSq3ZqVc0uKQadEmTY'
where lower(name) = 'essencial';

