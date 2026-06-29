alter table public.smart_invoice_import_items
  add column if not exists product_id uuid;

create index if not exists idx_smart_invoice_items_product_id
  on public.smart_invoice_import_items(product_id);
