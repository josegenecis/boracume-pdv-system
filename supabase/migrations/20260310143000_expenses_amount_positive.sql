alter table public.expenses
  add constraint expenses_amount_positive check (amount > 0);

