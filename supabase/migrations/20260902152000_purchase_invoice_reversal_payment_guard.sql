-- Impede que o estoque de uma compra seja estornado enquanto a conta vinculada
-- ainda possui baixas financeiras. O estorno da baixa deve acontecer primeiro,
-- preservando a trilha de auditoria e a consistencia entre financeiro e estoque.
create or replace function public.guard_purchase_invoice_reversal_with_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid_amount numeric(14,2);
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and new.expense_id is not null then
    select coalesce(expense.paid_amount, 0)
      into v_paid_amount
    from public.expenses expense
    where expense.id = new.expense_id
      and expense.user_id = new.user_id
    for update;

    if coalesce(v_paid_amount, 0) > 0 then
      raise exception 'Estorne primeiro os pagamentos da conta vinculada antes de cancelar a nota.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_purchase_invoice_reversal_payments on public.smart_invoice_imports;
create trigger guard_purchase_invoice_reversal_payments
before update of status on public.smart_invoice_imports
for each row execute function public.guard_purchase_invoice_reversal_with_payments();

notify pgrst, 'reload schema';
