create table if not exists public.pix_checkouts (
  id uuid primary key default gen_random_uuid(),
  restaurant_user_id uuid,
  correlation_id text unique,
  amount_cents integer,
  status text,
  provider text,
  order_payload jsonb,
  transaction_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pix_checkouts enable row level security;

-- Policies permissivas para facilitar o fluxo de checkout (Edge Function insere)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Enable all access for now') then
    create policy "Enable all access for now" on public.pix_checkouts for all using (true) with check (true);
  end if;
end $$;
