-- Preserve the ICMS-ST values effectively used in each issued fiscal item.
-- These columns mirror the retained-tax fields already available on products.
alter table public.nfce_items
  add column if not exists icms_st_base_retida numeric(14, 4) not null default 0,
  add column if not exists icms_st_aliquota numeric(7, 4) not null default 0,
  add column if not exists icms_substituto numeric(14, 4) not null default 0,
  add column if not exists icms_st_retido numeric(14, 4) not null default 0,
  add column if not exists icms_efetivo_reducao numeric(7, 4) not null default 0,
  add column if not exists icms_efetivo_aliquota numeric(7, 4) not null default 0;

comment on column public.nfce_items.icms_st_base_retida is
  'Base de calculo do ICMS-ST retido preservada no item fiscal emitido.';
comment on column public.nfce_items.icms_st_aliquota is
  'Aliquota do ICMS-ST retido preservada no item fiscal emitido.';
comment on column public.nfce_items.icms_substituto is
  'Valor do ICMS proprio do substituto preservado no item fiscal emitido.';
comment on column public.nfce_items.icms_st_retido is
  'Valor do ICMS-ST retido preservado no item fiscal emitido.';
comment on column public.nfce_items.icms_efetivo_reducao is
  'Percentual de reducao da base efetiva preservado no item fiscal emitido.';
comment on column public.nfce_items.icms_efetivo_aliquota is
  'Aliquota efetiva do ICMS preservada no item fiscal emitido.';

alter table public.nfce_items
  drop constraint if exists nfce_items_icms_st_values_valid,
  add constraint nfce_items_icms_st_values_valid check (
    icms_st_base_retida >= 0 and
    icms_substituto >= 0 and
    icms_st_retido >= 0 and
    icms_st_aliquota between 0 and 100 and
    icms_efetivo_reducao between 0 and 100 and
    icms_efetivo_aliquota between 0 and 100
  );
