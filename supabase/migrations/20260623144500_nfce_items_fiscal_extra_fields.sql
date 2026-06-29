alter table public.nfce_items
  add column if not exists origem text not null default '0',
  add column if not exists cest text,
  add column if not exists cbenef text;

comment on column public.nfce_items.origem is 'Origem da mercadoria usada no ICMS da NFC-e.';
comment on column public.nfce_items.cest is 'CEST do item quando sujeito a substituicao tributaria.';
comment on column public.nfce_items.cbenef is 'Codigo de beneficio fiscal do item, quando exigido pela UF.';
