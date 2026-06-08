alter table public.products
  add column if not exists barcode text;

create index if not exists products_user_barcode_idx
  on public.products (user_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

comment on column public.products.barcode is
  'Codigo lido por leitor de codigo de barras, QR code ou SKU para adicionar produtos no PDV.';
