do $$
begin
  if to_regclass('public.marketing_settings') is null then
    return;
  end if;

  if exists (
    select 1
    from public.marketing_settings
    group by user_id
    having count(*) > 1
  ) then
    with ranked as (
      select
        ctid,
        user_id,
        row_number() over (
          partition by user_id
          order by updated_at desc nulls last, created_at desc nulls last
        ) as rn
      from public.marketing_settings
    )
    delete from public.marketing_settings ms
    using ranked r
    where ms.ctid = r.ctid
      and r.rn > 1;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'marketing_settings'
      and indexname = 'marketing_settings_user_id_key'
  ) then
    execute 'create unique index marketing_settings_user_id_key on public.marketing_settings (user_id)';
  end if;
end $$;

