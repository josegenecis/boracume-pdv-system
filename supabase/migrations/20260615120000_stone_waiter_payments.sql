alter table public.payments
  drop constraint if exists payments_method_check;

alter table public.payments
  add constraint payments_method_check
  check (method in ('cash', 'pix', 'debit', 'credit', 'card'));

alter table public.payments
  add column if not exists provider text not null default 'manual',
  add column if not exists transaction_id text,
  add column if not exists atk text,
  add column if not exists nsu text,
  add column if not exists authorization_code text,
  add column if not exists installments integer,
  add column if not exists status text not null default 'approved',
  add column if not exists payment_date timestamptz,
  add column if not exists device_id text,
  add column if not exists terminal text,
  add column if not exists stone_code text,
  add column if not exists receipt_text text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_payments_transaction_id on public.payments(transaction_id);
create index if not exists idx_payments_provider on public.payments(provider);

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  account_id uuid references public.table_accounts(id) on delete set null,
  operator_id uuid references public.waiters(id) on delete set null,
  device_id text,
  transaction_id text,
  nsu text,
  atk text,
  amount numeric(12, 2) not null default 0,
  payment_method text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.payment_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_logs'
      and policyname = 'payment_logs_owner_all'
  ) then
    create policy payment_logs_owner_all
      on public.payment_logs
      for all
      using (restaurant_id = auth.uid())
      with check (restaurant_id = auth.uid());
  end if;
end $$;

create index if not exists idx_payment_logs_restaurant_id on public.payment_logs(restaurant_id);
create index if not exists idx_payment_logs_table_id on public.payment_logs(table_id);
create index if not exists idx_payment_logs_account_id on public.payment_logs(account_id);
create index if not exists idx_payment_logs_operator_id on public.payment_logs(operator_id);
create index if not exists idx_payment_logs_transaction_id on public.payment_logs(transaction_id);
create index if not exists idx_payment_logs_created_at on public.payment_logs(created_at desc);
