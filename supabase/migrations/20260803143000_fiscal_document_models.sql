-- Modelos fiscais separados do cadastro geral do emitente.
create table if not exists public.fiscal_document_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model_code text not null check (model_code in ('55', '65')),
  document_name text not null,
  enabled boolean not null default false,
  automatic_emission boolean not null default false,
  series text not null default '1',
  next_number bigint not null default 1 check (next_number > 0),
  environment text not null default 'homologacao' check (environment in ('homologacao', 'producao')),
  operation_nature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, model_code)
);

alter table public.fiscal_document_models enable row level security;
drop policy if exists fiscal_document_models_owner_all on public.fiscal_document_models;
create policy fiscal_document_models_owner_all on public.fiscal_document_models
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.fiscal_document_models (user_id, model_code, document_name, enabled, automatic_emission, series, next_number, environment)
select p.id, model.model_code, model.document_name,
  case when model.model_code = '65' then coalesce(fs.ativo, false) else false end,
  case when model.model_code = '65' then coalesce(fs.ativo, false) else false end,
  case when model.model_code = '65' then coalesce(fs.nfce_serie, '1') else '1' end,
  case when model.model_code = '65' then coalesce(fs.nfce_numero_atual, 1) else 1 end,
  coalesce(fs.ambiente, 'homologacao')
from public.profiles p
cross join (values ('55', 'NF-e'), ('65', 'NFC-e')) model(model_code, document_name)
left join public.fiscal_settings fs on fs.user_id = p.id
on conflict (user_id, model_code) do nothing;

create index if not exists fiscal_document_models_user_idx on public.fiscal_document_models(user_id);
