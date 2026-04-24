alter table public.product_categories
  add column if not exists is_pizza boolean not null default false;

alter table public.product_categories
  add column if not exists pizza_half_price_mode text not null default 'highest';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_categories_pizza_half_price_mode_check'
  ) then
    alter table public.product_categories
      add constraint product_categories_pizza_half_price_mode_check
      check (pizza_half_price_mode in ('highest', 'split_halves'));
  end if;
end
$$;
