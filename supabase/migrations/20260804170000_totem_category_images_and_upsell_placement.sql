alter table public.product_categories
  add column if not exists totem_image_url text;

alter table public.upsell_rules
  add column if not exists placement text not null default 'checkout';

update public.upsell_rules
set placement = 'checkout'
where placement is null or placement not in ('product', 'checkout', 'both');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upsell_rules_placement_check'
      and conrelid = 'public.upsell_rules'::regclass
  ) then
    alter table public.upsell_rules
      add constraint upsell_rules_placement_check
      check (placement in ('product', 'checkout', 'both'));
  end if;
end;
$$;

create index if not exists upsell_rules_totem_lookup_idx
  on public.upsell_rules (user_id, active, placement, display_order);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'totem-category-images',
  'totem-category-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read Totem category images" on storage.objects;
create policy "Public read Totem category images"
on storage.objects for select
to public
using (bucket_id = 'totem-category-images');

drop policy if exists "Stores upload Totem category images" on storage.objects;
create policy "Stores upload Totem category images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'totem-category-images'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Stores update Totem category images" on storage.objects;
create policy "Stores update Totem category images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'totem-category-images'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'totem-category-images'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Stores delete Totem category images" on storage.objects;
create policy "Stores delete Totem category images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'totem-category-images'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

comment on column public.product_categories.totem_image_url is
  'Optional image shown in the visual category rail of the self-service Totem.';

comment on column public.upsell_rules.placement is
  'Where the Totem presents the suggestion: product, checkout, or both.';
