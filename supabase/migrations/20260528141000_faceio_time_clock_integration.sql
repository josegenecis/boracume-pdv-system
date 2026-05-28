alter table public.waiters
  add column if not exists faceio_facial_id text,
  add column if not exists faceio_enrolled_at timestamptz,
  add column if not exists faceio_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_waiters_faceio_facial_id
  on public.waiters(user_id, faceio_facial_id)
  where faceio_facial_id is not null;

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
  check (face_liveness_mode in ('manual_review', 'provider_webhook', 'faceio'));

comment on column public.waiters.faceio_facial_id is
  'Identificador facial retornado pelo FACEIO para autenticação de ponto.';
