-- Matriz fiscal versionada. A classificacao do produto nao substitui a regra
-- da operacao: CFOP/CST/CSOSN dependem tambem de destino, destinatario,
-- finalidade, vigencia e legislacao estadual.

alter table public.products
  add column if not exists fiscal_icms_cst text,
  add column if not exists fiscal_icms_config jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_fiscal_icms_cst_check,
  add constraint products_fiscal_icms_cst_check check (
    fiscal_icms_cst is null or fiscal_icms_cst ~ '^(00|10|20|30|40|41|50|51|60|70|90)$'
  ),
  drop constraint if exists products_fiscal_icms_config_object_check,
  add constraint products_fiscal_icms_config_object_check check (
    jsonb_typeof(fiscal_icms_config) = 'object'
  );

comment on column public.products.fiscal_icms_cst is
  'CST ICMS do regime normal (CRT 2/3). O CSOSN do CRT 1 permanece em fiscal_csosn.';
comment on column public.products.fiscal_icms_config is
  'Parametros ICMS homologados para o produto quando nao houver regra operacional mais especifica.';

alter table public.fiscal_settings
  add column if not exists require_approved_fiscal_rules boolean not null default false;

comment on column public.fiscal_settings.require_approved_fiscal_rules is
  'Quando ativo, bloqueia a emissao se algum item nao resolver exatamente uma regra fiscal vigente e aprovada.';

create table if not exists public.fiscal_tax_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  active boolean not null default false,
  priority integer not null default 100 check (priority between 0 and 100000),
  valid_from date not null default current_date,
  valid_until date,
  model_codes text[] not null default array['55', '65']::text[],
  issuer_crt smallint[] not null,
  operation_type text not null default 'sale' check (
    operation_type in ('sale', 'return', 'transfer', 'bonus', 'consignment', 'remittance', 'import', 'export', 'other')
  ),
  operation_destination smallint check (operation_destination in (1, 2, 3)),
  origin_uf text,
  destination_uf text,
  recipient_ie_indicator smallint check (recipient_ie_indicator in (1, 2, 9)),
  final_consumer boolean,
  presence_indicator smallint,
  product_id uuid references public.products(id) on delete cascade,
  ncm_prefix text,
  cest text,
  product_origin smallint check (product_origin between 0 and 8),
  cfop text not null,
  icms_code text not null,
  icms_config jsonb not null default '{}'::jsonb,
  pis_cst text,
  pis_config jsonb not null default '{}'::jsonb,
  cofins_cst text,
  cofins_config jsonb not null default '{}'::jsonb,
  ipi_cst text,
  ipi_config jsonb not null default '{}'::jsonb,
  ibs_cbs_cst text,
  cclass_trib text,
  ibs_cbs_config jsonb not null default '{}'::jsonb,
  benefit_code text,
  legal_basis text not null,
  accountant_approved_at timestamptz,
  accountant_approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  check (cardinality(model_codes) > 0 and model_codes <@ array['55', '65']::text[]),
  check (cardinality(issuer_crt) > 0 and issuer_crt <@ array[1, 2, 3]::smallint[]),
  check (origin_uf is null or origin_uf ~ '^[A-Z]{2}$'),
  check (destination_uf is null or destination_uf ~ '^([A-Z]{2}|EX)$'),
  check (ncm_prefix is null or ncm_prefix ~ '^[0-9]{2,8}$'),
  check (cest is null or cest ~ '^[0-9]{7}$'),
  check (cfop ~ '^[567][0-9]{3}$'),
  check (icms_code ~ '^(101|102|103|201|202|203|300|400|500|900|00|10|20|30|40|41|50|51|60|70|90)$'),
  check (pis_cst is null or pis_cst ~ '^[0-9]{2}$'),
  check (cofins_cst is null or cofins_cst ~ '^[0-9]{2}$'),
  check (ipi_cst is null or ipi_cst ~ '^[0-9]{2}$'),
  check (ibs_cbs_cst is null or ibs_cbs_cst ~ '^[0-9]{3}$'),
  check (cclass_trib is null or cclass_trib ~ '^[0-9]{6}$'),
  check (jsonb_typeof(icms_config) = 'object'),
  check (jsonb_typeof(pis_config) = 'object'),
  check (jsonb_typeof(cofins_config) = 'object'),
  check (jsonb_typeof(ipi_config) = 'object'),
  check (jsonb_typeof(ibs_cbs_config) = 'object'),
  check (
    (issuer_crt <@ array[1]::smallint[] and icms_code ~ '^[0-9]{3}$') or
    (issuer_crt <@ array[2, 3]::smallint[] and icms_code ~ '^[0-9]{2}$')
  )
);

create index if not exists fiscal_tax_rules_resolution_idx
  on public.fiscal_tax_rules(user_id, active, operation_type, operation_destination, priority, valid_from, valid_until);
create index if not exists fiscal_tax_rules_product_idx
  on public.fiscal_tax_rules(user_id, product_id) where product_id is not null;
create index if not exists fiscal_tax_rules_ncm_idx
  on public.fiscal_tax_rules(user_id, ncm_prefix) where ncm_prefix is not null;

alter table public.fiscal_tax_rules enable row level security;
drop policy if exists fiscal_tax_rules_store_access on public.fiscal_tax_rules;
create policy fiscal_tax_rules_store_access on public.fiscal_tax_rules
  for all to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));

create or replace function public.protect_fiscal_rule_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and (
    (tg_op = 'INSERT' and (
      new.accountant_approved_at is not null or
      new.accountant_approved_by is not null
    )) or
    (tg_op = 'UPDATE' and (
      new.accountant_approved_at is distinct from old.accountant_approved_at or
      new.accountant_approved_by is distinct from old.accountant_approved_by
    ))
  ) then
    raise exception 'A aprovacao fiscal deve ser registrada pelo fluxo administrativo autorizado';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_fiscal_rule_approval_trigger on public.fiscal_tax_rules;
create trigger protect_fiscal_rule_approval_trigger
before insert or update on public.fiscal_tax_rules
for each row execute function public.protect_fiscal_rule_approval();

comment on table public.fiscal_tax_rules is
  'Regras fiscais versionadas e aprovadas para resolver CFOP e tributos por contexto da operacao. Regras inativas ou sem aprovacao nao podem autorizar emissao.';

alter table public.nfce_items
  add column if not exists fiscal_rule_id uuid references public.fiscal_tax_rules(id),
  add column if not exists regime_tributario smallint,
  add column if not exists operation_type text not null default 'sale',
  add column if not exists icms_config jsonb not null default '{}'::jsonb;

alter table public.nfce_items
  drop constraint if exists nfce_items_regime_tributario_check,
  add constraint nfce_items_regime_tributario_check check (regime_tributario is null or regime_tributario in (1, 2, 3)),
  drop constraint if exists nfce_items_operation_type_check,
  add constraint nfce_items_operation_type_check check (
    operation_type in ('sale', 'return', 'transfer', 'bonus', 'consignment', 'remittance', 'import', 'export', 'other')
  ),
  drop constraint if exists nfce_items_icms_config_object_check,
  add constraint nfce_items_icms_config_object_check check (jsonb_typeof(icms_config) = 'object');

comment on column public.nfce_items.fiscal_rule_id is
  'Regra fiscal exata usada na emissao, preservada para auditoria.';
comment on column public.nfce_items.icms_config is
  'Snapshot imutavel dos parametros de ICMS efetivamente usados no XML.';

-- Regra ativa so fica elegivel depois da aprovacao fiscal. Esta funcao retorna
-- no maximo uma regra; empate de prioridade e bloqueado para nao haver escolha
-- tributaria nao deterministica.
create or replace function public.resolve_fiscal_tax_rule(
  p_user_id uuid,
  p_model_code text,
  p_issuer_crt smallint,
  p_operation_type text,
  p_operation_destination smallint,
  p_origin_uf text,
  p_destination_uf text,
  p_recipient_ie_indicator smallint,
  p_final_consumer boolean,
  p_presence_indicator smallint,
  p_product_id uuid,
  p_ncm text,
  p_cest text,
  p_product_origin smallint,
  p_operation_date date default current_date
) returns setof public.fiscal_tax_rules
language sql stable security definer
set search_path = public
as $$
  select rule.*
  from public.fiscal_tax_rules rule
  where rule.user_id = p_user_id
    and public.can_access_store(p_user_id)
    and rule.active
    and rule.accountant_approved_at is not null
    and p_model_code = any(rule.model_codes)
    and p_issuer_crt = any(rule.issuer_crt)
    and rule.operation_type = p_operation_type
    and (rule.operation_destination is null or rule.operation_destination = p_operation_destination)
    and (rule.origin_uf is null or rule.origin_uf = p_origin_uf)
    and (rule.destination_uf is null or rule.destination_uf = p_destination_uf)
    and (rule.recipient_ie_indicator is null or rule.recipient_ie_indicator = p_recipient_ie_indicator)
    and (rule.final_consumer is null or rule.final_consumer = p_final_consumer)
    and (rule.presence_indicator is null or rule.presence_indicator = p_presence_indicator)
    and (rule.product_id is null or rule.product_id = p_product_id)
    and (rule.ncm_prefix is null or p_ncm like rule.ncm_prefix || '%')
    and (rule.cest is null or rule.cest = p_cest)
    and (rule.product_origin is null or rule.product_origin = p_product_origin)
    and rule.valid_from <= p_operation_date
    and (rule.valid_until is null or rule.valid_until >= p_operation_date)
  order by
    (rule.product_id is not null) desc,
    length(coalesce(rule.ncm_prefix, '')) desc,
    (rule.cest is not null) desc,
    (rule.destination_uf is not null) desc,
    rule.priority asc,
    rule.id asc
  limit 2;
$$;

revoke all on function public.resolve_fiscal_tax_rule(uuid, text, smallint, text, smallint, text, text, smallint, boolean, smallint, uuid, text, text, smallint, date) from public;
grant execute on function public.resolve_fiscal_tax_rule(uuid, text, smallint, text, smallint, text, text, smallint, boolean, smallint, uuid, text, text, smallint, date) to authenticated, service_role;

notify pgrst, 'reload schema';
