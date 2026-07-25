create table if not exists public.first_order_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Oferta de primeiro pedido',
  reward_type text not null check (reward_type in ('percent', 'fixed', 'free_product')),
  reward_value numeric(10,2) not null default 0 check (reward_value >= 0),
  product_id uuid references public.products(id) on delete set null,
  min_purchase numeric(10,2) not null default 0 check (min_purchase >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.first_order_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.first_order_promotions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_phone text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, customer_phone)
);

alter table public.first_order_promotions enable row level security;
alter table public.first_order_promotion_redemptions enable row level security;

drop policy if exists first_order_promotions_owner_all on public.first_order_promotions;
create policy first_order_promotions_owner_all
  on public.first_order_promotions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists first_order_redemptions_owner_select on public.first_order_promotion_redemptions;
create policy first_order_redemptions_owner_select
  on public.first_order_promotion_redemptions
  for select
  using (auth.uid() = user_id);

create or replace function public.register_first_order_promotion_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  promotion_uuid uuid;
  normalized_phone text;
begin
  if coalesce(new.coupon_code, '') not like 'PRIMEIRO:%' then
    return new;
  end if;

  begin
    promotion_uuid := split_part(new.coupon_code, ':', 2)::uuid;
  exception when others then
    raise exception 'Promoção de primeiro pedido inválida.';
  end;

  normalized_phone := regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g');
  if left(normalized_phone, 2) = '55' then
    normalized_phone := substr(normalized_phone, 3);
  end if;

  if length(normalized_phone) < 10 then
    raise exception 'Telefone inválido para aplicar a promoção de primeiro pedido.';
  end if;

  if not exists (
    select 1
      from public.first_order_promotions promotion
     where promotion.id = promotion_uuid
       and promotion.user_id = new.user_id
       and promotion.active = true
       and coalesce(new.total, 0) + coalesce(new.discount, 0) >= promotion.min_purchase
  ) then
    raise exception 'A promoção de primeiro pedido não está disponível.';
  end if;

  insert into public.first_order_promotion_redemptions (
    promotion_id, user_id, customer_phone, order_id
  ) values (
    promotion_uuid, new.user_id, normalized_phone, new.id
  );

  return new;
exception
  when unique_violation then
    raise exception 'Esta promoção de primeiro pedido já foi utilizada por este cliente.';
end;
$$;

drop trigger if exists orders_register_first_order_promotion on public.orders;
create trigger orders_register_first_order_promotion
after insert on public.orders
for each row execute function public.register_first_order_promotion_redemption();

alter table public.delivery_personnel
  add column if not exists daily_allowance numeric(10,2) not null default 0
  check (daily_allowance >= 0);

comment on column public.delivery_personnel.daily_allowance is
  'Ajuda de custo somada uma vez por dia de fechamento quando o motoboy possui entrega concluída.';
