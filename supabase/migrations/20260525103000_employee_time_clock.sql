create table if not exists public.employee_time_clock_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  require_location boolean not null default true,
  require_face_liveness boolean not null default true,
  require_device_binding boolean not null default true,
  allow_outside_radius boolean not null default false,
  restaurant_latitude numeric(10, 7),
  restaurant_longitude numeric(10, 7),
  allowed_radius_meters integer not null default 120,
  face_provider text not null default 'manual_review',
  face_provider_config jsonb not null default '{}'::jsonb,
  retention_days integer not null default 1825,
  policy_notice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_time_clock_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  device_fingerprint text not null,
  device_label text,
  trusted boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (waiter_id, device_fingerprint)
);

create table if not exists public.employee_time_clock_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  waiter_id uuid not null references public.waiters(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')),
  status text not null default 'approved' check (status in ('approved', 'pending_review', 'rejected')),
  occurred_at timestamptz not null default now(),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy_meters numeric(10, 2),
  distance_meters numeric(10, 2),
  within_geofence boolean,
  device_fingerprint text,
  device_trusted boolean,
  face_provider text,
  face_status text not null default 'not_configured' check (face_status in ('not_configured', 'pending_review', 'verified', 'failed')),
  face_score numeric(6, 4),
  face_reference_id text,
  selfie_url text,
  review_reason text,
  reviewed_by uuid references public.waiters(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_clock_events_user_date
  on public.employee_time_clock_events(user_id, occurred_at desc);
create index if not exists idx_time_clock_events_waiter_date
  on public.employee_time_clock_events(waiter_id, occurred_at desc);
create index if not exists idx_time_clock_devices_user
  on public.employee_time_clock_devices(user_id, waiter_id);

alter table public.employee_time_clock_settings enable row level security;
alter table public.employee_time_clock_devices enable row level security;
alter table public.employee_time_clock_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_time_clock_settings'
      and policyname = 'time_clock_settings_owner_all'
  ) then
    create policy time_clock_settings_owner_all
      on public.employee_time_clock_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_time_clock_devices'
      and policyname = 'time_clock_devices_owner_all'
  ) then
    create policy time_clock_devices_owner_all
      on public.employee_time_clock_devices
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_time_clock_events'
      and policyname = 'time_clock_events_owner_all'
  ) then
    create policy time_clock_events_owner_all
      on public.employee_time_clock_events
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.employee_time_clock_events is 'Registros auditaveis de ponto com localizacao, dispositivo e status de biometria facial/liveness.';
comment on column public.employee_time_clock_settings.face_provider_config is 'Configuracao nao sensivel do provedor facial. Segredos devem ficar em Edge Function secrets.';
