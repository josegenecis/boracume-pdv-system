alter table public.employee_time_clock_settings
  add column if not exists face_liveness_mode text not null default 'manual_review'
    check (face_liveness_mode in ('manual_review', 'provider_webhook')),
  add column if not exists face_min_score numeric(6,4) not null default 0.7500,
  add column if not exists face_store_evidence boolean not null default false,
  add column if not exists face_policy_version text not null default '2026-05-lgpd-v1';

alter table public.employee_time_clock_events
  add column if not exists face_liveness_passed boolean,
  add column if not exists face_challenge_id text,
  add column if not exists face_challenge_prompt text,
  add column if not exists face_evidence jsonb not null default '{}'::jsonb,
  add column if not exists privacy_acknowledged_at timestamptz;

comment on column public.employee_time_clock_settings.face_liveness_mode is
  'manual_review mantém a batida pendente para conferência humana; provider_webhook chama um provedor externo configurado por secrets.';

comment on column public.employee_time_clock_settings.face_store_evidence is
  'Quando falso, o sistema guarda apenas hashes/metadados da prova de vida, sem armazenar imagem bruta.';

comment on column public.employee_time_clock_events.face_evidence is
  'Evidências mínimas da prova de vida: desafio, checks do navegador, hashes de frames e retorno resumido do provedor.';
