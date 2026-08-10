-- Private and traceable attachments for restaurant purchase invoices.

alter table public.smart_invoice_imports
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

alter table public.expenses
  add column if not exists receipt_path text,
  add column if not exists receipt_name text,
  add column if not exists receipt_mime_type text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-invoice-attachments',
  'purchase-invoice-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners read expense attachments" on storage.objects;
create policy "Owners read expense attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Owners upload expense attachments" on storage.objects;
create policy "Owners upload expense attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Owners update expense attachments" on storage.objects;
create policy "Owners update expense attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Owners delete expense attachments" on storage.objects;
create policy "Owners delete expense attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

create index if not exists smart_invoice_imports_attachment_idx
  on public.smart_invoice_imports (user_id, created_at desc)
  where attachment_path is not null or receipt_url is not null;

comment on column public.smart_invoice_imports.attachment_path is
  'Private purchase-invoice-attachments bucket path for the original purchase invoice.';
comment on column public.expenses.receipt_path is
  'Private purchase-invoice-attachments bucket path; access must use a short-lived signed URL.';
