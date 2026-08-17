-- Estrutura completa e auditavel da Reforma Tributaria do Consumo.
-- Referencia de leiaute: NT 2025.002 v1.50. As tabelas CST/cClassTrib sao
-- versionadas: o aplicativo nao presume enquadramento tributario.

alter table public.fiscal_settings
  add column if not exists rtc_enabled boolean not null default false,
  add column if not exists rtc_strict_validation boolean not null default true,
  add column if not exists rtc_nt_version text not null default '2025.002-v1.50',
  add column if not exists rtc_cclass_table_version text;

comment on column public.fiscal_settings.rtc_enabled is
  'Habilita a geracao dos grupos RTC somente depois da matriz fiscal ser validada.';
comment on column public.fiscal_settings.rtc_strict_validation is
  'Bloqueia a emissao quando CST, cClassTrib, versao ou parametros RTC estiverem incompletos.';

alter table public.products
  alter column fiscal_ibs_cbs_cst drop not null,
  alter column fiscal_ibs_cbs_cst drop default,
  alter column fiscal_cclass_trib drop not null,
  alter column fiscal_cclass_trib drop default,
  add column if not exists fiscal_ibs_cbs_config jsonb not null default '{}'::jsonb,
  add column if not exists fiscal_is_cst text,
  add column if not exists fiscal_is_cclass_trib text,
  add column if not exists fiscal_is_config jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_fiscal_ibs_cbs_cst_format,
  add constraint products_fiscal_ibs_cbs_cst_format check (
    fiscal_ibs_cbs_cst is null or fiscal_ibs_cbs_cst ~ '^[0-9]{3}$'
  ),
  drop constraint if exists products_fiscal_cclass_trib_format,
  add constraint products_fiscal_cclass_trib_format check (
    fiscal_cclass_trib is null or fiscal_cclass_trib ~ '^[0-9]{6}$'
  ),
  drop constraint if exists products_fiscal_is_cst_format,
  add constraint products_fiscal_is_cst_format check (
    fiscal_is_cst is null or fiscal_is_cst ~ '^[0-9]{3}$'
  ),
  drop constraint if exists products_fiscal_is_cclass_trib_format,
  add constraint products_fiscal_is_cclass_trib_format check (
    fiscal_is_cclass_trib is null or fiscal_is_cclass_trib ~ '^[0-9]{6}$'
  ),
  drop constraint if exists products_fiscal_ibs_cbs_config_object,
  add constraint products_fiscal_ibs_cbs_config_object check (
    jsonb_typeof(fiscal_ibs_cbs_config) = 'object'
  ),
  drop constraint if exists products_fiscal_is_config_object,
  add constraint products_fiscal_is_config_object check (
    jsonb_typeof(fiscal_is_config) = 'object'
  );

alter table public.fiscal_tax_rules
  add column if not exists is_cst text,
  add column if not exists is_cclass_trib text,
  add column if not exists is_config jsonb not null default '{}'::jsonb,
  add column if not exists rtc_source_version text,
  add column if not exists rtc_table_version text;

alter table public.fiscal_tax_rules
  drop constraint if exists fiscal_tax_rules_is_cst_format,
  add constraint fiscal_tax_rules_is_cst_format check (
    is_cst is null or is_cst ~ '^[0-9]{3}$'
  ),
  drop constraint if exists fiscal_tax_rules_is_cclass_format,
  add constraint fiscal_tax_rules_is_cclass_format check (
    is_cclass_trib is null or is_cclass_trib ~ '^[0-9]{6}$'
  ),
  drop constraint if exists fiscal_tax_rules_is_config_object,
  add constraint fiscal_tax_rules_is_config_object check (
    jsonb_typeof(is_config) = 'object'
  ),
  drop constraint if exists fiscal_tax_rules_rtc_pair,
  add constraint fiscal_tax_rules_rtc_pair check (
    (ibs_cbs_cst is null and cclass_trib is null) or
    (ibs_cbs_cst is not null and cclass_trib is not null)
  ),
  drop constraint if exists fiscal_tax_rules_is_pair,
  add constraint fiscal_tax_rules_is_pair check (
    (is_cst is null and is_cclass_trib is null) or
    (is_cst is not null and is_cclass_trib is not null)
  );

comment on column public.fiscal_tax_rules.ibs_cbs_config is
  'Parametros RTC: mode standard|monophase|transfer_credit|none, IBS-UF, IBS-Mun, CBS, diferimento, devolucao, credito presumido e tributacao regular.';
comment on column public.fiscal_tax_rules.is_config is
  'Parametros do Imposto Seletivo por aliquota percentual e/ou especifica.';
comment on column public.fiscal_tax_rules.rtc_source_version is
  'Versao da Nota Tecnica usada na elaboracao e aprovacao da regra.';
comment on column public.fiscal_tax_rules.rtc_table_version is
  'Versao da tabela oficial CST/cClassTrib usada na aprovacao da regra.';

create table if not exists public.fiscal_rtc_classifications (
  id uuid primary key default gen_random_uuid(),
  tax_kind text not null check (tax_kind in ('IBS_CBS', 'IS')),
  cst text not null check (cst ~ '^[0-9]{3}$'),
  cclass_trib text not null check (cclass_trib ~ '^[0-9]{6}$'),
  description text not null,
  indicators jsonb not null default '{}'::jsonb check (jsonb_typeof(indicators) = 'object'),
  nt_version text not null,
  table_version text not null,
  source_url text not null,
  source_sha256 text,
  valid_from date not null,
  valid_until date,
  active boolean not null default true,
  imported_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique (tax_kind, cst, cclass_trib, table_version)
);

create index if not exists fiscal_rtc_classifications_lookup_idx
  on public.fiscal_rtc_classifications(tax_kind, cst, cclass_trib, active, valid_from, valid_until);

alter table public.fiscal_rtc_classifications enable row level security;
drop policy if exists fiscal_rtc_classifications_read on public.fiscal_rtc_classifications;
create policy fiscal_rtc_classifications_read on public.fiscal_rtc_classifications
  for select to authenticated using (true);

comment on table public.fiscal_rtc_classifications is
  'Espelho versionado das tabelas oficiais CST/cClassTrib. Carga somente por processo administrativo autenticado com fonte e hash.';

alter table public.nfce_items
  add column if not exists rtc_config jsonb not null default '{}'::jsonb,
  add column if not exists is_cst text,
  add column if not exists is_cclass_trib text,
  add column if not exists is_config jsonb not null default '{}'::jsonb,
  add column if not exists valor_is numeric(13,2) not null default 0,
  add column if not exists rtc_nt_version text,
  add column if not exists rtc_table_version text;

alter table public.nfce_items
  drop constraint if exists nfce_items_rtc_config_object,
  add constraint nfce_items_rtc_config_object check (jsonb_typeof(rtc_config) = 'object'),
  drop constraint if exists nfce_items_is_config_object,
  add constraint nfce_items_is_config_object check (jsonb_typeof(is_config) = 'object'),
  drop constraint if exists nfce_items_is_cst_format,
  add constraint nfce_items_is_cst_format check (is_cst is null or is_cst ~ '^[0-9]{3}$'),
  drop constraint if exists nfce_items_is_cclass_format,
  add constraint nfce_items_is_cclass_format check (is_cclass_trib is null or is_cclass_trib ~ '^[0-9]{6}$');

comment on column public.nfce_items.rtc_config is
  'Snapshot imutavel dos parametros IBS/CBS usados para montar o XML.';
comment on column public.nfce_items.is_config is
  'Snapshot imutavel dos parametros do Imposto Seletivo usados no XML.';

-- Uma regra aprovada e imutavel para o usuario comum. Alteracao administrativa
-- invalida a aprovacao e exige nova conferencia do responsavel fiscal.
create or replace function public.protect_fiscal_rule_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  material_change boolean := false;
begin
  if tg_op = 'UPDATE' then
    material_change :=
      new.cfop is distinct from old.cfop or
      new.icms_code is distinct from old.icms_code or
      new.icms_config is distinct from old.icms_config or
      new.pis_cst is distinct from old.pis_cst or
      new.pis_config is distinct from old.pis_config or
      new.cofins_cst is distinct from old.cofins_cst or
      new.cofins_config is distinct from old.cofins_config or
      new.ibs_cbs_cst is distinct from old.ibs_cbs_cst or
      new.cclass_trib is distinct from old.cclass_trib or
      new.ibs_cbs_config is distinct from old.ibs_cbs_config or
      new.is_cst is distinct from old.is_cst or
      new.is_cclass_trib is distinct from old.is_cclass_trib or
      new.is_config is distinct from old.is_config or
      new.rtc_source_version is distinct from old.rtc_source_version or
      new.rtc_table_version is distinct from old.rtc_table_version or
      new.legal_basis is distinct from old.legal_basis or
      new.valid_from is distinct from old.valid_from or
      new.valid_until is distinct from old.valid_until;
  end if;

  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' and (
      new.accountant_approved_at is not null or new.accountant_approved_by is not null
    ) then
      raise exception 'A aprovacao fiscal deve ser registrada pelo fluxo administrativo autorizado';
    end if;
    if tg_op = 'UPDATE' and (
      new.accountant_approved_at is distinct from old.accountant_approved_at or
      new.accountant_approved_by is distinct from old.accountant_approved_by
    ) then
      raise exception 'A aprovacao fiscal deve ser registrada pelo fluxo administrativo autorizado';
    end if;
    if tg_op = 'UPDATE' and old.accountant_approved_at is not null and material_change then
      raise exception 'Regra fiscal aprovada e imutavel; crie uma nova versao para alterar a tributacao';
    end if;
  elsif tg_op = 'UPDATE' and old.accountant_approved_at is not null and material_change then
    new.accountant_approved_at := null;
    new.accountant_approved_by := null;
    new.active := false;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
