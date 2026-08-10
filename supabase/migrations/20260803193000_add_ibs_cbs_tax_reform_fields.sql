-- Reforma Tributaria do Consumo (NT 2025.002): configuracao por produto,
-- aliquotas vigentes por emitente e fotografia fiscal imutavel por item emitido.
alter table public.fiscal_settings
  add column if not exists rtc_aliquota_ibs_uf numeric(7,4) not null default 0.1000,
  add column if not exists rtc_aliquota_ibs_mun numeric(7,4) not null default 0.0000,
  add column if not exists rtc_aliquota_cbs numeric(7,4) not null default 0.9000;

alter table public.products
  add column if not exists fiscal_ibs_cbs_cst text not null default '000',
  add column if not exists fiscal_cclass_trib text not null default '000001',
  add column if not exists fiscal_reducao_ibs numeric(7,4) not null default 0.0000,
  add column if not exists fiscal_reducao_cbs numeric(7,4) not null default 0.0000;

alter table public.nfce_items
  add column if not exists cst_ibs_cbs text,
  add column if not exists cclass_trib text,
  add column if not exists aliquota_ibs_uf numeric(7,4) default 0,
  add column if not exists aliquota_ibs_mun numeric(7,4) default 0,
  add column if not exists aliquota_cbs numeric(7,4) default 0,
  add column if not exists reducao_ibs numeric(7,4) default 0,
  add column if not exists reducao_cbs numeric(7,4) default 0,
  add column if not exists valor_base_ibs_cbs numeric(13,2) default 0,
  add column if not exists valor_ibs_uf numeric(13,2) default 0,
  add column if not exists valor_ibs_mun numeric(13,2) default 0,
  add column if not exists valor_ibs numeric(13,2) default 0,
  add column if not exists valor_cbs numeric(13,2) default 0;

comment on column public.fiscal_settings.rtc_aliquota_ibs_uf is 'Aliquota nominal vigente do IBS estadual, em percentual; lida em cada emissao.';
comment on column public.fiscal_settings.rtc_aliquota_ibs_mun is 'Aliquota nominal vigente do IBS municipal, em percentual; lida em cada emissao.';
comment on column public.fiscal_settings.rtc_aliquota_cbs is 'Aliquota nominal vigente da CBS, em percentual; lida em cada emissao.';
comment on column public.products.fiscal_ibs_cbs_cst is 'CST do IBS/CBS conforme tabela vigente da RTC.';
comment on column public.products.fiscal_cclass_trib is 'Codigo cClassTrib da RTC. Deve ser validado com a operacao e a tabela oficial vigente.';
comment on column public.products.fiscal_reducao_ibs is 'Reducao da aliquota do IBS em percentual para CST que a exija.';
comment on column public.products.fiscal_reducao_cbs is 'Reducao da aliquota da CBS em percentual para CST que a exija.';
comment on column public.nfce_items.cst_ibs_cbs is 'CST IBS/CBS usado na emissao, preservado no item fiscal.';
comment on column public.nfce_items.cclass_trib is 'cClassTrib usado na emissao, preservado no item fiscal.';

alter table public.products drop constraint if exists products_fiscal_ibs_cbs_cst_format;
alter table public.products add constraint products_fiscal_ibs_cbs_cst_format
  check (fiscal_ibs_cbs_cst ~ '^\d{3}$');

alter table public.products drop constraint if exists products_fiscal_cclass_trib_format;
alter table public.products add constraint products_fiscal_cclass_trib_format
  check (fiscal_cclass_trib ~ '^\d{6}$' and left(fiscal_cclass_trib, 3) = fiscal_ibs_cbs_cst);

alter table public.products drop constraint if exists products_fiscal_reducao_ibs_range;
alter table public.products add constraint products_fiscal_reducao_ibs_range
  check (fiscal_reducao_ibs between 0 and 100);

alter table public.products drop constraint if exists products_fiscal_reducao_cbs_range;
alter table public.products add constraint products_fiscal_reducao_cbs_range
  check (fiscal_reducao_cbs between 0 and 100);
