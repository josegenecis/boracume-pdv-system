alter table public.pix_checkouts enable row level security;

drop policy if exists "pix_checkouts_public_read_by_correlation_header" on public.pix_checkouts;
create policy "pix_checkouts_public_read_by_correlation_header"
  on public.pix_checkouts
  for select
  to anon
  using (
    correlation_id = (current_setting('request.headers', true)::jsonb ->> 'x-pix-correlation')
  );

