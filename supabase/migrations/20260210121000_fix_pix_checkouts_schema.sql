create extension if not exists pgcrypto;

create table if not exists public.pix_checkouts (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null,
  correlation_id text not null unique,
  amount_cents integer not null,
  status text not null default 'CREATED',
  provider text not null default 'mercadopago',
  order_payload jsonb not null,
  order_id uuid,
  transaction_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pix_checkouts
  add column if not exists order_id uuid,
  add column if not exists transaction_id text,
  add column if not exists metadata jsonb,
  add column if not exists provider text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.pix_checkouts
  alter column provider set default 'mercadopago',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.pix_checkouts
set provider = coalesce(provider, 'mercadopago')
where provider is null;

update public.pix_checkouts
set created_at = coalesce(created_at, now())
where created_at is null;

update public.pix_checkouts
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists pix_checkouts_restaurant_user_id_idx on public.pix_checkouts(restaurant_user_id);
create index if not exists pix_checkouts_correlation_id_idx on public.pix_checkouts(correlation_id);
create index if not exists pix_checkouts_status_idx on public.pix_checkouts(status);

alter table public.pix_checkouts enable row level security;

drop policy if exists "pix_checkouts_restaurant_read" on public.pix_checkouts;
create policy "pix_checkouts_restaurant_read"
  on public.pix_checkouts for select
  using (restaurant_user_id = auth.uid());

drop policy if exists "pix_checkouts_restaurant_write" on public.pix_checkouts;
create policy "pix_checkouts_restaurant_write"
  on public.pix_checkouts for insert
  with check (restaurant_user_id = auth.uid());

drop policy if exists "pix_checkouts_restaurant_update" on public.pix_checkouts;
create policy "pix_checkouts_restaurant_update"
  on public.pix_checkouts for update
  using (restaurant_user_id = auth.uid())
  with check (restaurant_user_id = auth.uid());

