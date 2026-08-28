alter table public.products
  add column if not exists fiscal_icms_st_base_ret_unit numeric(14, 4),
  add column if not exists fiscal_icms_st_aliquota numeric(7, 4),
  add column if not exists fiscal_icms_substituto_unit numeric(14, 4),
  add column if not exists fiscal_icms_st_ret_unit numeric(14, 4),
  add column if not exists fiscal_icms_efetivo_reducao numeric(7, 4),
  add column if not exists fiscal_icms_efetivo_aliquota numeric(7, 4);

comment on column public.products.fiscal_icms_st_base_ret_unit is 'Base de calculo do ICMS-ST retido na entrada, por unidade comercial, para CST 60 ou CSOSN 500.';
comment on column public.products.fiscal_icms_st_aliquota is 'Aliquota do ICMS-ST retido informada no documento de entrada.';
comment on column public.products.fiscal_icms_substituto_unit is 'ICMS proprio do substituto, por unidade comercial, informado no documento de entrada.';
comment on column public.products.fiscal_icms_st_ret_unit is 'ICMS-ST retido, por unidade comercial, informado no documento de entrada.';
comment on column public.products.fiscal_icms_efetivo_reducao is 'Percentual de reducao da base efetiva do ICMS na venda ao consumidor final.';
comment on column public.products.fiscal_icms_efetivo_aliquota is 'Aliquota efetiva interna do ICMS na venda ao consumidor final.';

alter table public.products
  drop constraint if exists products_fiscal_icms_st_values_check;

alter table public.products
  add constraint products_fiscal_icms_st_values_check check (
    coalesce(fiscal_icms_st_base_ret_unit, 0) >= 0 and
    coalesce(fiscal_icms_substituto_unit, 0) >= 0 and
    coalesce(fiscal_icms_st_ret_unit, 0) >= 0 and
    coalesce(fiscal_icms_st_aliquota, 0) between 0 and 100 and
    coalesce(fiscal_icms_efetivo_reducao, 0) between 0 and 100 and
    coalesce(fiscal_icms_efetivo_aliquota, 0) between 0 and 100
  );
