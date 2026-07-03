alter table public.restaurant_checklist_settings
  add column if not exists public_token text,
  add column if not exists title text not null default 'Checklist operacional';

update public.restaurant_checklist_settings
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table public.restaurant_checklist_settings
  alter column public_token set not null;

create unique index if not exists restaurant_checklist_settings_public_token_idx
  on public.restaurant_checklist_settings(public_token);

create or replace function public.get_checklist_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.restaurant_checklist_settings%rowtype;
  v_restaurant_name text;
  v_tasks jsonb;
  v_run jsonb;
begin
  select *
    into v_settings
  from public.restaurant_checklist_settings
  where public_token = p_token;

  if not found then
    raise exception 'Checklist não encontrado';
  end if;

  select restaurant_name
    into v_restaurant_name
  from public.profiles
  where id = v_settings.user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'area', t.area,
        'shift', t.shift,
        'sort_order', t.sort_order,
        'required', t.required
      )
      order by t.sort_order, t.created_at
    ),
    '[]'::jsonb
  )
    into v_tasks
  from public.restaurant_checklist_tasks t
  where t.user_id = v_settings.user_id
    and t.active = true;

  select to_jsonb(r)
    into v_run
  from public.restaurant_checklist_runs r
  where r.user_id = v_settings.user_id
    and r.business_date = current_date;

  return jsonb_build_object(
    'restaurant_id', v_settings.user_id,
    'restaurant_name', coalesce(nullif(v_restaurant_name, ''), 'Restaurante'),
    'title', v_settings.title,
    'enabled', v_settings.enabled,
    'require_daily', v_settings.require_daily,
    'business_date', current_date,
    'tasks', v_tasks,
    'run', v_run
  );
end;
$$;

create or replace function public.submit_checklist_by_token(
  p_token text,
  p_checked_task_ids uuid[],
  p_notes text default null,
  p_completed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.restaurant_checklist_settings%rowtype;
  v_missing_required integer;
  v_run public.restaurant_checklist_runs%rowtype;
begin
  select *
    into v_settings
  from public.restaurant_checklist_settings
  where public_token = p_token;

  if not found then
    raise exception 'Checklist não encontrado';
  end if;

  if v_settings.enabled is not true then
    raise exception 'Checklist não está ativo';
  end if;

  select count(*)
    into v_missing_required
  from public.restaurant_checklist_tasks t
  where t.user_id = v_settings.user_id
    and t.active = true
    and t.required = true
    and not (t.id = any(coalesce(p_checked_task_ids, '{}'::uuid[])));

  if v_missing_required > 0 then
    raise exception 'Checklist incompleto';
  end if;

  insert into public.restaurant_checklist_runs (
    user_id,
    business_date,
    status,
    checked_task_ids,
    notes,
    completed_by,
    completed_at,
    updated_at
  )
  values (
    v_settings.user_id,
    current_date,
    'completed',
    coalesce(p_checked_task_ids, '{}'::uuid[]),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(nullif(trim(coalesce(p_completed_by, '')), ''), 'Funcionário'),
    now(),
    now()
  )
  on conflict (user_id, business_date)
  do update set
    status = excluded.status,
    checked_task_ids = excluded.checked_task_ids,
    notes = excluded.notes,
    completed_by = excluded.completed_by,
    completed_at = excluded.completed_at,
    updated_at = now()
  returning * into v_run;

  return to_jsonb(v_run);
end;
$$;

grant execute on function public.get_checklist_by_token(text) to anon, authenticated;
grant execute on function public.submit_checklist_by_token(text, uuid[], text, text) to anon, authenticated;
