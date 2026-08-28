-- A fundamentacao legal complementa a operacao, mas nao e obrigatoria para
-- cadastrar ou aprovar uma regra fiscal.

alter table public.fiscal_tax_rules
  alter column legal_basis drop not null;

create or replace function public.approve_fiscal_tax_rule_homologation(
  p_rule_id uuid,
  p_responsible text
) returns public.fiscal_tax_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.fiscal_tax_rules;
  v_environment text;
  v_issuer_uf text;
  v_rate_text text;
  v_rate numeric;
  v_rtc_mode text;
  v_is_enabled boolean;
  v_rtc_nt_version text;
  v_rtc_table_version text;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado'; end if;

  select * into v_rule from public.fiscal_tax_rules where id = p_rule_id for update;
  if not found or not public.can_access_store(v_rule.user_id) then
    raise exception 'Operacao fiscal nao encontrada ou sem permissao';
  end if;

  select ambiente, upper(trim(endereco_uf)) into v_environment, v_issuer_uf
  from public.fiscal_settings where user_id = v_rule.user_id;
  if coalesce(v_environment, '') <> 'homologacao' then
    raise exception 'Este fluxo de aprovacao e exclusivo do ambiente de homologacao';
  end if;
  if v_issuer_uf is null or not (v_issuer_uf = any(array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) then
    raise exception 'Cadastre uma UF valida no emitente antes de aprovar a operacao';
  end if;
  if v_rule.product_id is not null or v_rule.ncm_prefix is not null or v_rule.cest is not null then
    raise exception 'Produto, NCM e CEST nao pertencem a operacao fiscal';
  end if;
  if v_rule.operation_type is distinct from 'sale' then
    raise exception 'Nesta versao, somente operacoes de venda podem ser aprovadas';
  end if;
  if v_rule.operation_destination not in (1, 2, 3) then
    raise exception 'Informe se a operacao e interna, interestadual ou exterior';
  end if;
  if v_rule.operation_destination = 1 and v_rule.destination_uf is distinct from v_issuer_uf then
    raise exception 'Operacao interna deve usar a UF do emitente como destino';
  elsif v_rule.operation_destination = 2 and (
    v_rule.destination_uf is null or v_rule.destination_uf = v_issuer_uf or
    not (v_rule.destination_uf = any(array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']))
  ) then
    raise exception 'Operacao interestadual exige uma UF de destino valida e diferente da origem';
  elsif v_rule.operation_destination = 3 and v_rule.destination_uf is distinct from 'EX' then
    raise exception 'Operacao exterior deve usar EX como destino';
  end if;
  if v_rule.presence_indicator is null
    or v_rule.presence_indicator not in (0, 1, 2, 3, 4, 5, 9) then
    raise exception 'Indicador de presenca invalido';
  end if;
  if v_rule.product_origin is null
    or v_rule.product_origin not between 0 and 8 then
    raise exception 'Origem do produto invalida';
  end if;
  if length(trim(coalesce(p_responsible, ''))) < 3 then
    raise exception 'Informe o responsavel pela validacao fiscal';
  end if;
  if not exists (
    select 1 from public.fiscal_cfop_catalog c
    where c.code = v_rule.cfop and c.active and c.operation_destination = v_rule.operation_destination
  ) then
    raise exception 'CFOP inexistente ou incompatível com o destino da operacao';
  end if;
  if cardinality(v_rule.issuer_crt) <> 1 then
    raise exception 'A operacao deve pertencer a um unico regime tributario';
  end if;
  if v_rule.issuer_crt[1] = 1 and not (v_rule.icms_code = any(array['101','102','103','201','202','203','300','400','500','900'])) then
    raise exception 'CSOSN invalido para o Simples Nacional';
  end if;
  if v_rule.issuer_crt[1] in (2, 3) and not (v_rule.icms_code = any(array['00','10','20','30','40','41','50','51','60','70','90'])) then
    raise exception 'CST ICMS invalido para o regime informado';
  end if;
  if v_rule.pis_cst is null or not (v_rule.pis_cst = any(array['01','02','03','04','05','06','07','08','09','49','50','51','52','53','54','55','56','60','61','62','63','64','65','66','67','70','71','72','73','74','75','98','99'])) then
    raise exception 'CST PIS invalido';
  end if;
  if v_rule.cofins_cst is null or not (v_rule.cofins_cst = any(array['01','02','03','04','05','06','07','08','09','49','50','51','52','53','54','55','56','60','61','62','63','64','65','66','67','70','71','72','73','74','75','98','99'])) then
    raise exception 'CST COFINS invalido';
  end if;
  if v_rule.ipi_cst is not null and not (v_rule.ipi_cst = any(array['00','01','02','03','04','05','49','50','51','52','53','54','55','99'])) then
    raise exception 'CST IPI invalido';
  end if;

  if v_rule.operation_destination = 2 then
    v_rate_text := v_rule.icms_config #>> '{difal,internalRate}';
    if coalesce(v_rate_text, '') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'Informe a aliquota interna do ICMS da UF de destino';
    end if;
    v_rate := v_rate_text::numeric;
    if v_rate <= 0 or v_rate > 100 then raise exception 'Aliquota interna da UF de destino invalida'; end if;
  end if;

  v_rtc_mode := coalesce(v_rule.ibs_cbs_config->>'mode', 'none');
  if v_rtc_mode <> 'none' then
    if v_rule.ibs_cbs_cst is null or v_rule.cclass_trib is null then
      raise exception 'IBS/CBS exige CST e cClassTrib';
    end if;
    select c.nt_version, c.table_version into v_rtc_nt_version, v_rtc_table_version
    from public.fiscal_rtc_classifications c
    where c.tax_kind = 'IBS_CBS' and c.cst = v_rule.ibs_cbs_cst
      and c.cclass_trib = v_rule.cclass_trib and c.active
      and c.valid_from <= current_date and (c.valid_until is null or c.valid_until >= current_date)
    order by c.valid_from desc, c.imported_at desc limit 1;
    if not found then raise exception 'CST/cClassTrib de IBS/CBS nao consta na tabela oficial vigente'; end if;
  end if;

  v_is_enabled := lower(coalesce(v_rule.is_config->>'enabled', 'false')) in ('true', '1', 'yes', 'on');
  if v_is_enabled then
    if v_rule.is_cst is null or v_rule.is_cclass_trib is null then
      raise exception 'Imposto Seletivo exige CST e cClassTrib';
    end if;
    if not exists (
      select 1 from public.fiscal_rtc_classifications c
      where c.tax_kind = 'IS' and c.cst = v_rule.is_cst and c.cclass_trib = v_rule.is_cclass_trib
        and c.active and c.valid_from <= current_date and (c.valid_until is null or c.valid_until >= current_date)
    ) then raise exception 'CST/cClassTrib do Imposto Seletivo nao consta na tabela oficial vigente'; end if;
  end if;

  perform set_config('app.fiscal_approval_flow', 'authorized', true);
  update public.fiscal_tax_rules
  set origin_uf = v_issuer_uf,
      rtc_source_version = case when v_rtc_mode <> 'none' then v_rtc_nt_version else null end,
      rtc_table_version = case when v_rtc_mode <> 'none' then v_rtc_table_version else null end,
      accountant_approved_at = now(), accountant_approved_by = trim(p_responsible),
      active = true, updated_at = now()
  where id = p_rule_id returning * into v_rule;

  update public.fiscal_settings set require_approved_fiscal_rules = true, updated_at = now()
  where user_id = v_rule.user_id;
  return v_rule;
end;
$$;

revoke all on function public.approve_fiscal_tax_rule_homologation(uuid, text) from public;
grant execute on function public.approve_fiscal_tax_rule_homologation(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
