alter table public.waiters
  add column if not exists local_face_enrolled_at timestamptz,
  add column if not exists local_face_profile jsonb not null default '{}'::jsonb;

create index if not exists idx_waiters_local_face_enrolled
  on public.waiters(user_id, local_face_enrolled_at)
  where local_face_enrolled_at is not null;

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.employee_time_clock_settings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%face_liveness_mode%';

  if constraint_name is not null then
    execute format('alter table public.employee_time_clock_settings drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.employee_time_clock_settings
  add constraint employee_time_clock_settings_face_liveness_mode_check
  check (face_liveness_mode in ('manual_review', 'provider_webhook', 'faceio', 'simple_liveness'));

update public.employee_time_clock_settings
set
  face_liveness_mode = 'simple_liveness',
  face_provider = 'simple_liveness'
where coalesce(face_liveness_mode, '') in ('', 'faceio')
   or coalesce(face_provider, '') in ('', 'faceio');

comment on column public.waiters.local_face_enrolled_at is
  'Data do cadastro facial simples do funcionario para controle de ponto PopSystem.';

comment on column public.waiters.local_face_profile is
  'Metadados e evidencias resumidas do cadastro facial simples. Nao substitui biometria homologada de terceiros.';
