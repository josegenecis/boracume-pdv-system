-- Recupera a rastreabilidade das notas lançadas antes do fluxo transacional.

update public.smart_invoice_import_items item
set stock_quantity_added = round(
  item.quantity
  * coalesce(ingredient.purchase_conversion, 1)
  * (coalesce(ingredient.yield_percentage, 100) / 100),
  6
)
from public.ingredients ingredient, public.smart_invoice_imports import_row
where import_row.status = 'committed'
  and item.import_id = import_row.id
  and item.ingredient_id = ingredient.id
  and item.user_id = ingredient.user_id
  and item.control_stock = true
  and coalesce(item.stock_quantity_added, 0) = 0;

update public.smart_invoice_import_items item
set product_quantity_added = greatest(1, floor(item.quantity)::integer)
from public.smart_invoice_imports import_row
where item.import_id = import_row.id
  and import_row.status = 'committed'
  and item.product_id is not null
  and coalesce(item.product_quantity_added, 0) = 0;

update public.smart_invoice_imports import_row
set launch_expense = import_row.expense_id is not null,
    launch_stock = exists (
      select 1 from public.smart_invoice_import_items item
      where item.import_id = import_row.id
        and (item.ingredient_id is not null or item.product_id is not null)
    ),
    committed_at = coalesce(import_row.committed_at, import_row.updated_at, import_row.created_at)
where import_row.status = 'committed';

notify pgrst, 'reload schema';
