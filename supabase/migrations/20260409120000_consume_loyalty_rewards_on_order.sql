create or replace function public.normalize_phone(value text)
returns text
language plpgsql
immutable
as $$
declare digits text;
begin
  digits := regexp_replace(coalesce(value, ''), '\D', '', 'g');
  if digits = '' then
    return '';
  end if;
  if left(digits, 2) = '55' then
    return digits;
  end if;
  return '55' || digits;
end $$;

create or replace function public.consume_customer_reward_on_order()
returns trigger
language plpgsql
as $$
declare normalized_phone text;
declare coupon text;
begin
  coupon := upper(btrim(coalesce(new.coupon_code, '')));
  if coupon = '' then
    return new;
  end if;

  normalized_phone := public.normalize_phone(new.customer_phone);
  if normalized_phone = '' then
    return new;
  end if;

  update public.customer_rewards r
  set status = 'used',
      used_at = now(),
      order_id = new.id
  from public.loyalty_programs p
  where r.program_id = p.id
    and p.active = true
    and r.user_id = new.user_id
    and r.customer_phone = normalized_phone
    and r.code = coupon
    and r.status = 'available';

  return new;
end $$;

drop trigger if exists trg_consume_customer_reward_on_order on public.orders;
create trigger trg_consume_customer_reward_on_order
after insert or update of coupon_code on public.orders
for each row
execute function public.consume_customer_reward_on_order();
