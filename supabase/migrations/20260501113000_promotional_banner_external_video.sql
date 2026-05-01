alter table public.promotional_banners
add column if not exists media_source text not null default 'file',
add column if not exists external_video_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotional_banners_media_source_check'
  ) then
    alter table public.promotional_banners
      add constraint promotional_banners_media_source_check
      check (media_source in ('file', 'instagram'));
  end if;
end $$;

update public.promotional_banners
set media_source = 'file'
where media_source is null;
