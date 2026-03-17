alter table public.promotional_banners
add column if not exists banner_type text not null default 'wide';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotional_banners_banner_type_check'
  ) then
    alter table public.promotional_banners
      add constraint promotional_banners_banner_type_check
      check (banner_type in ('wide', 'tile'));
  end if;
end $$;

update public.promotional_banners
set banner_type = 'wide'
where banner_type is null;

create index if not exists promotional_banners_user_type_active_order_idx
on public.promotional_banners (user_id, banner_type, active, display_order);

