create table if not exists public.poppay_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'poppay_oauth',
  user_agent text,
  terms_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists poppay_terms_acceptances_user_version_idx
  on public.poppay_terms_acceptances (user_id, terms_version, accepted_at desc);

alter table public.poppay_terms_acceptances enable row level security;

comment on table public.poppay_terms_acceptances is
  'Registro imutavel dos aceites apresentados antes da autorizacao OAuth do PopPay.';

revoke update, delete, truncate on public.poppay_terms_acceptances from anon, authenticated;
