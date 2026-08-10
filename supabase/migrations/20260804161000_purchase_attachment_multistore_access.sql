-- Allow a network owner to manage attachments of any accessible store while
-- keeping every object private from unrelated accounts.

drop policy if exists "Owners read expense attachments" on storage.objects;
create policy "Owners read expense attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Owners upload expense attachments" on storage.objects;
create policy "Owners upload expense attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Owners update expense attachments" on storage.objects;
create policy "Owners update expense attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Owners delete expense attachments" on storage.objects;
create policy "Owners delete expense attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'purchase-invoice-attachments'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and public.can_access_store(split_part(name, '/', 1)::uuid)
);
