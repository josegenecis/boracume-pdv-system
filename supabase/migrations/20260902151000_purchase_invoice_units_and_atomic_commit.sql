-- Mantém a assinatura existente, mas completa o commit atômico com unidades,
-- conversão e metadados financeiros conferidos pelo usuário.
create or replace function public.commit_purchase_invoice_import(
  p_import_id uuid,
  p_store_user_id uuid,
  p_items jsonb,
  p_launch_expense boolean default true,
  p_launch_stock boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.smart_invoice_imports%rowtype;
  v_item jsonb;
  v_db_item public.smart_invoice_import_items%rowtype;
  v_ingredient public.ingredients%rowtype;
  v_product public.products%rowtype;
  v_category public.product_categories%rowtype;
  v_expense_id uuid;
  v_name text;
  v_category_name text;
  v_subcategory text;
  v_description text;
  v_purchase_unit text;
  v_stock_unit text;
  v_quantity numeric(18,6);
  v_conversion numeric(18,6);
  v_unit_price numeric(18,6);
  v_total numeric(18,6);
  v_items_total numeric(18,2) := 0;
  v_total_amount numeric(18,2) := 0;
  v_product_qty numeric(18,6);
  v_purchase_result jsonb;
  v_stock_result jsonb := '[]'::jsonb;
  v_create_sale_product boolean;
  v_control_stock boolean;
  v_unit_confirmed boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas pelo processador seguro de notas.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A nota não possui itens válidos para lançamento.';
  end if;
  if not coalesce(p_launch_expense, false) and not coalesce(p_launch_stock, false) then
    raise exception 'Selecione o lançamento no financeiro, no estoque ou em ambos.';
  end if;

  select * into v_import from public.smart_invoice_imports
  where id = p_import_id and user_id = p_store_user_id for update;
  if not found then raise exception 'Nota de compra não encontrada.'; end if;
  if v_import.status = 'committed' then raise exception 'Esta nota já foi lançada.'; end if;
  if v_import.status = 'cancelled' then raise exception 'Uma nota cancelada não pode ser lançada novamente.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'id', '') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Um item da nota não possui identificação válida.';
    end if;
    select * into v_db_item from public.smart_invoice_import_items
    where id = (v_item->>'id')::uuid and import_id = p_import_id and user_id = p_store_user_id
    for update;
    if not found then raise exception 'Item da nota não encontrado.'; end if;

    v_name := nullif(trim(coalesce(v_item->>'normalized_name', v_item->>'description', '')), '');
    v_description := coalesce(nullif(trim(v_item->>'description'), ''), v_name);
    v_category_name := coalesce(nullif(trim(v_item->>'category'), ''), 'Insumos');
    v_subcategory := nullif(trim(v_item->>'subcategory'), '');
    v_purchase_unit := case lower(coalesce(v_item->>'unit', 'un'))
      when 'kg' then 'kg' when 'g' then 'g' when 'l' then 'l' when 'ml' then 'ml'
      when 'cx' then 'cx' when 'pct' then 'pct' when 'fd' then 'fd' when 'bd' then 'bd'
      when 'dz' then 'dz' else 'un' end;
    v_stock_unit := case lower(coalesce(v_item->>'stock_unit', v_purchase_unit))
      when 'kg' then 'kg' when 'g' then 'g' when 'l' then 'l' when 'ml' then 'ml'
      when 'cx' then 'cx' when 'pct' then 'pct' when 'fd' then 'fd' when 'bd' then 'bd'
      when 'dz' then 'dz' else 'un' end;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_conversion := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::numeric, 1), 0.000001);
    v_unit_price := greatest(coalesce(nullif(v_item->>'unit_price', '')::numeric, 0), 0);
    v_total := round(coalesce(nullif(v_item->>'total_price', '')::numeric, v_quantity * v_unit_price), 2);
    v_control_stock := coalesce((v_item->>'control_stock')::boolean, true);
    v_unit_confirmed := coalesce((v_item->>'unit_confirmed')::boolean, false);

    if v_name is null then raise exception 'Informe o nome de todos os itens.'; end if;
    if v_quantity <= 0 then raise exception 'A quantidade de % deve ser maior que zero.', v_name; end if;
    if v_total < 0 then raise exception 'O total de % não pode ser negativo.', v_name; end if;
    if p_launch_stock and v_control_stock and not v_unit_confirmed then
      raise exception 'Confirme a unidade de medida de % antes de movimentar o estoque.', v_name;
    end if;

    update public.smart_invoice_import_items
    set description = v_description, normalized_name = v_name, category = v_category_name,
        subcategory = v_subcategory, quantity = v_quantity, unit = v_purchase_unit,
        stock_unit = v_stock_unit, conversion_factor = v_conversion,
        unit_price = v_unit_price, total_price = v_total, control_stock = v_control_stock,
        unit_source = case when v_unit_confirmed then 'confirmed' else coalesce(v_item->>'unit_source', 'unknown') end,
        unit_confirmed = v_unit_confirmed
    where id = v_db_item.id;

    v_items_total := v_items_total + v_total;
  end loop;

  v_total_amount := case when coalesce(v_import.total_amount, 0) > 0 then v_import.total_amount else v_items_total end;
  if v_total_amount <= 0 then raise exception 'O total da nota deve ser maior que zero.'; end if;

  if p_launch_expense then
    insert into public.expenses (
      user_id, description, amount, category, expense_date, due_date, competence_date,
      status, paid_amount, payable_origin_type, supplier_name, document_number,
      payment_method, receipt_url, receipt_path, receipt_name, receipt_mime_type,
      created_by, updated_by
    ) values (
      p_store_user_id,
      trim(concat('Nota de compra', case when v_import.supplier_name is not null then ' - ' || v_import.supplier_name else '' end,
        case when v_import.invoice_number is not null then ' - NF ' || v_import.invoice_number else '' end)),
      v_total_amount, coalesce(v_import.expense_category, 'Insumos'),
      coalesce(v_import.invoice_date, current_date), coalesce(v_import.due_date, v_import.invoice_date, current_date),
      coalesce(v_import.invoice_date, current_date),
      case when coalesce(v_import.due_date, v_import.invoice_date, current_date) < current_date then 'overdue' else 'open' end,
      0, 'purchase_invoice', v_import.supplier_name, v_import.invoice_number,
      v_import.payment_method, v_import.receipt_url, v_import.attachment_path,
      v_import.attachment_name, v_import.attachment_mime_type, p_store_user_id, p_store_user_id
    ) returning id into v_expense_id;
  end if;

  if p_launch_stock then
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      if not coalesce((v_item->>'control_stock')::boolean, true) then continue; end if;

      select * into v_db_item from public.smart_invoice_import_items
      where id = (v_item->>'id')::uuid for update;
      v_name := v_db_item.normalized_name;
      v_create_sale_product := coalesce((v_item->>'create_sale_product')::boolean, false);

      select * into v_ingredient from public.ingredients
      where user_id = p_store_user_id and lower(trim(name)) = lower(trim(v_name))
      order by created_at limit 1 for update;

      if not found then
        insert into public.ingredients (
          user_id, name, category, subcategory, unit, purchase_unit, purchase_conversion,
          yield_percentage, cost_price, price, current_stock, min_stock, stock_controlled, is_active
        ) values (
          p_store_user_id, v_name, v_db_item.category, v_db_item.subcategory, v_db_item.stock_unit,
          v_db_item.unit, v_db_item.conversion_factor, 100, 0, 0, 0, 0, true, true
        ) returning * into v_ingredient;
      else
        update public.ingredients
        set category = v_db_item.category,
            subcategory = coalesce(v_db_item.subcategory, subcategory),
            unit = v_db_item.stock_unit,
            purchase_unit = v_db_item.unit,
            purchase_conversion = v_db_item.conversion_factor,
            stock_controlled = true,
            updated_at = now()
        where id = v_ingredient.id returning * into v_ingredient;
      end if;

      select public.record_ingredient_purchase(
        v_ingredient.id, v_db_item.quantity, v_db_item.unit_price,
        concat('Entrada pela nota de compra ', coalesce(v_import.invoice_number, v_import.id::text)), p_store_user_id
      ) into v_purchase_result;

      update public.smart_invoice_import_items
      set ingredient_id = v_ingredient.id,
          stock_quantity_added = coalesce((v_purchase_result->>'stock_added')::numeric, 0)
      where id = v_db_item.id;

      if v_create_sale_product then
        v_category_name := coalesce(nullif(trim(v_db_item.category), ''), 'Mercadorias');
        select * into v_category from public.product_categories
        where user_id = p_store_user_id and lower(trim(name)) = lower(v_category_name)
        order by created_at limit 1;
        if not found then
          insert into public.product_categories(user_id, name, description, active, display_order)
          values (p_store_user_id, v_category_name, 'Categoria criada a partir de nota de compra.', true,
            coalesce((select max(display_order) + 1 from public.product_categories where user_id = p_store_user_id), 1))
          returning * into v_category;
        end if;

        select * into v_product from public.products
        where user_id = p_store_user_id and lower(trim(name)) = lower(trim(v_name))
        order by created_at limit 1 for update;
        v_product_qty := greatest(coalesce((v_purchase_result->>'stock_added')::numeric, v_db_item.quantity * v_db_item.conversion_factor), 0.000001);
        if not found then
          insert into public.products (
            user_id, name, description, category, category_id, price, available, is_available,
            show_in_pdv, show_in_delivery, track_stock, stock_quantity, low_stock_threshold
          ) values (
            p_store_user_id, v_name, v_db_item.description, v_category.name, v_category.id,
            round(greatest(v_db_item.unit_price * 1.8, 0), 2), true, true, true, false, true, v_product_qty, 5
          ) returning * into v_product;
        else
          update public.products
          set category = coalesce(nullif(category, ''), v_category.name),
              category_id = coalesce(category_id, v_category.id), track_stock = true,
              stock_quantity = coalesce(stock_quantity, 0) + v_product_qty, updated_at = now()
          where id = v_product.id returning * into v_product;
        end if;

        insert into public.inventory_movements(user_id, product_id, type, quantity)
        values (p_store_user_id, v_product.id, 'purchase', v_product_qty);

        update public.smart_invoice_import_items
        set product_id = v_product.id, product_quantity_added = v_product_qty
        where id = v_db_item.id;
      end if;

      v_stock_result := v_stock_result || jsonb_build_array(jsonb_build_object(
        'item', v_name, 'ingredient_id', v_ingredient.id,
        'product_id', case when v_create_sale_product then v_product.id else null end,
        'purchase_quantity', v_db_item.quantity, 'purchase_unit', v_db_item.unit,
        'stock_quantity', coalesce((v_purchase_result->>'stock_added')::numeric, 0),
        'stock_unit', v_db_item.stock_unit, 'conversion_factor', v_db_item.conversion_factor
      ));
    end loop;
  end if;

  update public.smart_invoice_imports
  set status = 'committed', expense_id = v_expense_id, total_amount = v_total_amount,
      launch_expense = p_launch_expense, launch_stock = p_launch_stock,
      committed_at = now(), updated_at = now()
  where id = v_import.id;

  return jsonb_build_object('ok', true, 'expense_id', v_expense_id, 'stock', v_stock_result,
    'total_amount', v_total_amount, 'items_total', v_items_total);
end;
$$;

revoke all on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) from public;
grant execute on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) to service_role;

notify pgrst, 'reload schema';
