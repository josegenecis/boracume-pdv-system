create table if not exists public.pix_checkouts (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid not null,
  correlation_id text not null unique,
  amount_cents integer not null,
  status text not null default 'CREATED',
  provider text not null default 'openpix',
  order_payload jsonb not null,
  order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pix_checkouts_restaurant_user_id_idx on public.pix_checkouts(restaurant_user_id);

alter table public.pix_checkouts enable row level security;

create policy if not exists "pix_checkouts_restaurant_read"
  on public.pix_checkouts for select
  using (restaurant_user_id = auth.uid());

create policy if not exists "pix_checkouts_restaurant_write"
  on public.pix_checkouts for insert
  with check (restaurant_user_id = auth.uid());

create policy if not exists "pix_checkouts_restaurant_update"
  on public.pix_checkouts for update
  using (restaurant_user_id = auth.uid());
