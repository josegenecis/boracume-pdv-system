-- Repara ambientes em que a migração original de estorno foi registrada,
-- mas as colunas não chegaram a ser criadas fisicamente.

alter table public.expenses
  add column if not exists is_active boolean not null default true;

alter table public.expenses
  add column if not exists reversed_at timestamptz;

alter table public.expenses
  add column if not exists reversal_reason text;

alter table public.expenses
  add column if not exists reversed_by uuid references auth.users(id);

create index if not exists expenses_user_active_date_idx
  on public.expenses (user_id, is_active, expense_date desc);

notify pgrst, 'reload schema';
