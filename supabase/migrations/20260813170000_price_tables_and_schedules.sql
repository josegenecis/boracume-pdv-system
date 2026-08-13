-- Central price tables and scheduled promotions.
-- This migration is intentionally additive: products.price remains the permanent
-- base price and no existing restaurant receives an active rule automatically.

create table if not exists public.price_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'custom' check (kind in ('promotion', 'happy_hour', 'channel', 'custom')),
  channel text not null default 'all' check (channel in ('all', 'pdv', 'delivery', 'totem', 'whatsapp', 'dine_in', 'pickup')),
  priority integer not null default 100 check (priority between 0 and 10000),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week smallint[],
  start_time time,
  end_time time,
  timezone text not null default 'America/Fortaleza',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_tables_period_check check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint price_tables_days_check check (days_of_week is null or days_of_week <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.price_table_items (
  id uuid primary key default gen_random_uuid(),
  price_table_id uuid not null references public.price_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('fixed_price', 'percentage_discount', 'percentage_markup', 'amount_discount')),
  adjustment_value numeric(12,4) not null check (adjustment_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_table_items_target_check check (
    (product_id is not null and category_id is null) or
    (product_id is null and category_id is not null) or
    (product_id is null and category_id is null)
  )
);

create table if not exists public.price_change_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_price_tables_active_schedule
  on public.price_tables (user_id, active, channel, priority desc, starts_at, ends_at);
create index if not exists idx_price_table_items_table
  on public.price_table_items (price_table_id, active);
create index if not exists idx_price_table_items_product
  on public.price_table_items (user_id, product_id) where product_id is not null;
create index if not exists idx_price_table_items_category
  on public.price_table_items (user_id, category_id) where category_id is not null;

alter table public.price_tables enable row level security;
alter table public.price_table_items enable row level security;
alter table public.price_change_audit enable row level security;

drop policy if exists "Owners manage price tables" on public.price_tables;
create policy "Owners manage price tables" on public.price_tables
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners manage price table items" on public.price_table_items;
create policy "Owners manage price table items" on public.price_table_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Owners read price audit" on public.price_change_audit;
create policy "Owners read price audit" on public.price_change_audit
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Owners create price audit" on public.price_change_audit;
create policy "Owners create price audit" on public.price_change_audit
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.touch_price_record()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_price_tables_touch on public.price_tables;
create trigger trg_price_tables_touch before update on public.price_tables
for each row execute function public.touch_price_record();
drop trigger if exists trg_price_table_items_touch on public.price_table_items;
create trigger trg_price_table_items_touch before update on public.price_table_items
for each row execute function public.touch_price_record();

-- Safe, read-only resolver used by PDV, cardapio, totem and WhatsApp. It returns
-- only the winning price, never the restaurant's private rule configuration.
create or replace function public.resolve_product_prices(
  p_user_id uuid,
  p_channel text default 'all',
  p_product_ids uuid[] default null,
  p_at timestamptz default now()
)
returns table (
  product_id uuid,
  base_price numeric,
  effective_price numeric,
  price_table_id uuid,
  price_rule_id uuid,
  price_table_name text,
  price_source text,
  discount_percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with product_base as (
    select p.id, p.category_id, greatest(0, coalesce(p.price, 0))::numeric as base_price
    from public.products p
    where p.user_id = p_user_id
      and (p_product_ids is null or p.id = any(p_product_ids))
  ), candidates as (
    select
      pb.id as product_id,
      pb.base_price,
      pt.id as table_id,
      pti.id as rule_id,
      pt.name as table_name,
      pti.adjustment_type,
      pti.adjustment_value,
      row_number() over (
        partition by pb.id
        order by
          (pti.product_id is not null) desc,
          (pti.category_id is not null) desc,
          (pt.channel <> 'all') desc,
          pt.priority desc,
          pt.updated_at desc,
          pti.updated_at desc
      ) as position
    from product_base pb
    join public.price_table_items pti
     on pti.user_id = p_user_id
     and pti.active
     and (pti.product_id = pb.id or pti.category_id = pb.category_id or (pti.product_id is null and pti.category_id is null))
    join public.price_tables pt
      on pt.id = pti.price_table_id
     and pt.user_id = p_user_id
     and pt.active
     and pt.channel in ('all', coalesce(nullif(lower(p_channel), ''), 'all'))
     and (pt.starts_at is null or p_at >= pt.starts_at)
     and (pt.ends_at is null or p_at < pt.ends_at)
     and (
       pt.days_of_week is null or
       extract(dow from (p_at at time zone pt.timezone))::smallint = any(pt.days_of_week)
     )
     and (
       pt.start_time is null or pt.end_time is null or
       case
         when pt.start_time <= pt.end_time then
           (p_at at time zone pt.timezone)::time >= pt.start_time and
           (p_at at time zone pt.timezone)::time < pt.end_time
         else
           (p_at at time zone pt.timezone)::time >= pt.start_time or
           (p_at at time zone pt.timezone)::time < pt.end_time
       end
     )
  ), winner as (
    select * from candidates where position = 1
  )
  select
    pb.id,
    round(pb.base_price, 2),
    round(greatest(0, case w.adjustment_type
      when 'fixed_price' then w.adjustment_value
      when 'percentage_discount' then pb.base_price * (1 - w.adjustment_value / 100)
      when 'percentage_markup' then pb.base_price * (1 + w.adjustment_value / 100)
      when 'amount_discount' then pb.base_price - w.adjustment_value
      else pb.base_price
    end), 2),
    w.table_id,
    w.rule_id,
    w.table_name,
    case when w.rule_id is null then 'base' else 'price_table' end,
    case when w.adjustment_type = 'percentage_discount' then w.adjustment_value else null end
  from product_base pb
  left join winner w on w.product_id = pb.id;
$$;

revoke all on function public.resolve_product_prices(uuid, text, uuid[], timestamptz) from public;
grant execute on function public.resolve_product_prices(uuid, text, uuid[], timestamptz) to anon, authenticated, service_role;
