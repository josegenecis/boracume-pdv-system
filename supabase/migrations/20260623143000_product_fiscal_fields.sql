alter table public.products
  add column if not exists fiscal_ncm text,
  add column if not exists fiscal_cfop text,
  add column if not exists fiscal_csosn text,
  add column if not exists fiscal_cst_pis text,
  add column if not exists fiscal_cst_cofins text,
  add column if not exists fiscal_origem text not null default '0',
  add column if not exists fiscal_cest text,
  add column if not exists fiscal_beneficio text,
  add column if not exists fiscal_observacao text;

comment on column public.products.fiscal_ncm is 'NCM do produto usado na emissao de NFC-e.';
comment on column public.products.fiscal_cfop is 'CFOP do produto usado na emissao de NFC-e.';
comment on column public.products.fiscal_csosn is 'CSOSN/CST ICMS do produto usado na emissao de NFC-e.';
comment on column public.products.fiscal_cst_pis is 'CST PIS do produto usado na emissao de NFC-e.';
comment on column public.products.fiscal_cst_cofins is 'CST COFINS do produto usado na emissao de NFC-e.';
comment on column public.products.fiscal_origem is 'Origem da mercadoria para ICMS. 0=nacional.';
comment on column public.products.fiscal_cest is 'CEST para produtos sujeitos a substituicao tributaria, quando aplicavel.';
comment on column public.products.fiscal_beneficio is 'Codigo de beneficio fiscal, quando exigido pela UF.';
comment on column public.products.fiscal_observacao is 'Observacao fiscal interna do produto.';
