create or replace view public.restaurant_tables as
select
  id,
  user_id,
  table_number as number,
  capacity,
  location,
  status,
  created_at,
  updated_at
from public.tables;

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'serving', 'payment_pending', 'closed')),
  guest_count integer not null default 1,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by_waiter_id uuid,
  reopened_from_session_id uuid references public.table_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.table_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'table_sessions'
      and policyname = 'table_sessions_owner_all'
  ) then
    create policy table_sessions_owner_all
      on public.table_sessions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.table_accounts
  alter column table_id drop not null;

alter table public.table_accounts
  add column if not exists session_id uuid references public.table_sessions(id) on delete cascade,
  add column if not exists account_number integer,
  add column if not exists name text,
  add column if not exists paid_at timestamptz,
  add column if not exists opened_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists opened_by_waiter_id uuid;

create index if not exists idx_table_sessions_user_id on public.table_sessions(user_id);
create index if not exists idx_table_sessions_table_id on public.table_sessions(table_id);
create index if not exists idx_table_sessions_status on public.table_sessions(status);
create index if not exists idx_table_accounts_session_id on public.table_accounts(session_id);
create index if not exists idx_table_accounts_account_number on public.table_accounts(account_number);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  account_id uuid not null references public.table_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_name text not null,
  price numeric(12,2) not null default 0,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  account_id uuid references public.table_accounts(id) on delete set null,
  waiter_id uuid,
  method text not null check (method in ('cash', 'pix', 'card')),
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'order_items_owner_all'
  ) then
    create policy order_items_owner_all
      on public.order_items
      for all
      using (
        exists (
          select 1
          from public.table_sessions s
          where s.id = session_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.table_sessions s
          where s.id = session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_item_options'
      and policyname = 'order_item_options_owner_all'
  ) then
    create policy order_item_options_owner_all
      on public.order_item_options
      for all
      using (
        exists (
          select 1
          from public.order_items i
          join public.table_sessions s on s.id = i.session_id
          where i.id = order_item_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.order_items i
          join public.table_sessions s on s.id = i.session_id
          where i.id = order_item_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_owner_all'
  ) then
    create policy payments_owner_all
      on public.payments
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.orders
  add column if not exists session_id uuid references public.table_sessions(id) on delete set null,
  add column if not exists account_id uuid references public.table_accounts(id) on delete set null;

create index if not exists idx_order_items_session_id on public.order_items(session_id);
create index if not exists idx_order_items_account_id on public.order_items(account_id);
create index if not exists idx_order_item_options_order_item_id on public.order_item_options(order_item_id);
create index if not exists idx_payments_session_id on public.payments(session_id);
create index if not exists idx_payments_account_id on public.payments(account_id);
create index if not exists idx_orders_session_id on public.orders(session_id);
create index if not exists idx_orders_account_id on public.orders(account_id);

create or replace function public.touch_waiter_mobile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_table_sessions_updated_at on public.table_sessions;
create trigger touch_table_sessions_updated_at
before update on public.table_sessions
for each row execute function public.touch_waiter_mobile_updated_at();

drop trigger if exists touch_order_items_updated_at on public.order_items;
create trigger touch_order_items_updated_at
before update on public.order_items
for each row execute function public.touch_waiter_mobile_updated_at();
