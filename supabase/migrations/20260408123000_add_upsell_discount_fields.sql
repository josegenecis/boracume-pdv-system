alter table public.upsell_rules
add column if not exists discount_type text,
add column if not exists discount_value numeric(10,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upsell_rules_discount_type_check'
  ) then
    alter table public.upsell_rules
    add constraint upsell_rules_discount_type_check
    check (discount_type in ('percentage', 'fixed') or discount_type is null);
  end if;
end $$;
