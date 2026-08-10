-- Full-screen idle advertising for the Totem.
-- Supports an ordered mix of up to 5 videos and 15 images per restaurant.

alter table public.totem_settings
  add column if not exists idle_timeout_minutes integer not null default 3
    check (idle_timeout_minutes between 1 and 60);

alter table public.totem_banners
  add column if not exists media_type text;

update public.totem_banners
set media_type = case
  when lower(split_part(media_url, '?', 1)) ~ '\.(mp4|webm|ogg|mov)$' then 'video'
  else 'image'
end
where media_type is null;

alter table public.totem_banners
  alter column media_type set default 'image',
  alter column media_type set not null;

alter table public.totem_banners
  drop constraint if exists totem_banners_media_type_check;

alter table public.totem_banners
  add constraint totem_banners_media_type_check
  check (media_type in ('image', 'video'));

create or replace function public.enforce_totem_media_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
  v_limit integer;
begin
  v_limit := case when new.media_type = 'video' then 5 else 15 end;

  select count(*) into v_count
  from public.totem_banners banner
  where banner.user_id = new.user_id
    and banner.media_type = new.media_type
    and banner.id is distinct from new.id;

  if v_count >= v_limit then
    if new.media_type = 'video' then
      raise exception using
        errcode = 'P0001',
        message = 'Limite de 5 vídeos por Totem atingido.';
    else
      raise exception using
        errcode = 'P0001',
        message = 'Limite de 15 imagens por Totem atingido.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_totem_media_limits on public.totem_banners;
create trigger enforce_totem_media_limits
before insert or update of user_id, media_type on public.totem_banners
for each row execute function public.enforce_totem_media_limits();

create or replace function public.reorder_totem_media(
  p_first_id uuid,
  p_first_order integer,
  p_second_id uuid,
  p_second_order integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.totem_banners
  set display_order = case
    when id = p_first_id then p_first_order
    when id = p_second_id then p_second_order
  end
  where id in (p_first_id, p_second_id)
    and user_id = auth.uid();

  if not found then
    raise exception 'Mídias do Totem não encontradas ou sem permissão.';
  end if;
end;
$$;

revoke all on function public.reorder_totem_media(uuid, integer, uuid, integer) from public, anon;
grant execute on function public.reorder_totem_media(uuid, integer, uuid, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'totem-media',
  'totem-media',
  true,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read Totem media" on storage.objects;
create policy "Public read Totem media"
on storage.objects for select
to public
using (bucket_id = 'totem-media');

drop policy if exists "Owners upload Totem media" on storage.objects;
create policy "Owners upload Totem media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'totem-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Owners update Totem media" on storage.objects;
create policy "Owners update Totem media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'totem-media'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'totem-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Owners delete Totem media" on storage.objects;
create policy "Owners delete Totem media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'totem-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

comment on column public.totem_settings.idle_timeout_minutes is
  'Minutes without interaction before the Totem clears the session and starts idle advertising.';
comment on column public.totem_banners.media_type is
  'Explicit media kind used for playback and per-restaurant limits.';
