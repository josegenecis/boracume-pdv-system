-- Lançamento manual de compra com classificação assistida e vínculo seguro ao catálogo.
-- A IA sugere o vínculo; esta função sempre valida a propriedade dos registros e
-- movimenta financeiro/insumo/produto em uma única transação.

alter table public.smart_invoice_imports
  drop constraint if exists smart_invoice_imports_source_type_check;

alter table public.smart_invoice_imports
  add constraint smart_invoice_imports_source_type_check
  check (source_type in ('image', 'pdf', 'xml', 'manual'));

alter table public.smart_invoice_import_items
  add column if not exists inventory_kind text not null default 'ingredient',
  add column if not exists match_confidence numeric(5,4) not null default 0,
  add column if not exists matched_product_tracks_stock boolean not null default false,
  add column if not exists create_sale_product boolean not null default false;

alter table public.smart_invoice_import_items
  drop constraint if exists smart_invoice_import_items_inventory_kind_check,
  add constraint smart_invoice_import_items_inventory_kind_check
    check (inventory_kind in ('ingredient', 'resale_product', 'packaging', 'cleaning', 'service', 'other')),
  drop constraint if exists smart_invoice_import_items_match_confidence_check,
  add constraint smart_invoice_import_items_match_confidence_check
    check (match_confidence >= 0 and match_confidence <= 1);

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
  v_inventory_kind text;
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
  v_product_updated boolean;
  v_requested_ingredient_id uuid;
  v_requested_product_id uuid;
  v_competence_date date;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas pelo processador seguro de notas.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A compra não possui itens válidos para lançamento.';
  end if;
  if not coalesce(p_launch_expense, false) and not coalesce(p_launch_stock, false) then
    raise exception 'Selecione o lançamento no financeiro, no estoque ou em ambos.';
  end if;

  select * into v_import from public.smart_invoice_imports
  where id = p_import_id and user_id = p_store_user_id for update;
  if not found then raise exception 'Compra não encontrada.'; end if;
  if v_import.status = 'committed' then raise exception 'Esta compra já foi lançada.'; end if;
  if v_import.status = 'cancelled' then raise exception 'Uma compra cancelada não pode ser lançada novamente.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Um item da compra não possui identificação válida.';
    end if;
    select * into v_db_item from public.smart_invoice_import_items
    where id = (v_item->>'id')::uuid and import_id = p_import_id and user_id = p_store_user_id
    for update;
    if not found then raise exception 'Item da compra não encontrado.'; end if;

    v_name := nullif(trim(coalesce(v_item->>'normalized_name', v_item->>'description', '')), '');
    v_description := coalesce(nullif(trim(v_item->>'description'), ''), v_name);
    v_category_name := coalesce(nullif(trim(v_item->>'category'), ''), 'Insumos');
    v_subcategory := nullif(trim(v_item->>'subcategory'), '');
    v_inventory_kind := lower(coalesce(nullif(trim(v_item->>'inventory_kind'), ''), 'ingredient'));
    if v_inventory_kind not in ('ingredient', 'resale_product', 'packaging', 'cleaning', 'service', 'other') then
      v_inventory_kind := 'other';
    end if;
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

    v_requested_ingredient_id := case
      when coalesce(v_item->>'ingredient_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_item->>'ingredient_id')::uuid else null end;
    v_requested_product_id := case
      when coalesce(v_item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_item->>'product_id')::uuid else null end;

    if v_requested_ingredient_id is not null and not exists (
      select 1 from public.ingredients where id = v_requested_ingredient_id and user_id = p_store_user_id
    ) then raise exception 'O insumo sugerido para % não pertence a esta loja.', v_name; end if;
    if v_requested_product_id is not null and not exists (
      select 1 from public.products where id = v_requested_product_id and user_id = p_store_user_id
    ) then raise exception 'O produto sugerido para % não pertence a esta loja.', v_name; end if;

    update public.smart_invoice_import_items
    set description = v_description, normalized_name = v_name, category = v_category_name,
        subcategory = v_subcategory, quantity = v_quantity, unit = v_purchase_unit,
        stock_unit = v_stock_unit, conversion_factor = v_conversion,
        unit_price = v_unit_price, total_price = v_total, control_stock = v_control_stock,
        unit_source = case when v_unit_confirmed then 'confirmed' else coalesce(v_item->>'unit_source', 'unknown') end,
        unit_confirmed = v_unit_confirmed, inventory_kind = v_inventory_kind,
        ingredient_id = v_requested_ingredient_id, product_id = v_requested_product_id,
        matched_product_tracks_stock = coalesce((v_item->>'matched_product_tracks_stock')::boolean, false),
        create_sale_product = coalesce((v_item->>'create_sale_product')::boolean, false),
        match_confidence = least(greatest(coalesce(nullif(v_item->>'match_confidence', '')::numeric, 0), 0), 1)
    where id = v_db_item.id;

    v_items_total := v_items_total + v_total;
  end loop;

  v_total_amount := case when coalesce(v_import.total_amount, 0) > 0 then v_import.total_amount else v_items_total end;
  if v_total_amount <= 0 then raise exception 'O total da compra deve ser maior que zero.'; end if;

  if p_launch_expense then
    v_competence_date := case
      when coalesce(v_import.raw_ai_response->>'competence_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (v_import.raw_ai_response->>'competence_date')::date
      else coalesce(v_import.invoice_date, current_date) end;
    insert into public.expenses (
      user_id, description, amount, category, expense_date, due_date, competence_date,
      status, paid_amount, payable_origin_type, supplier_name, document_number,
      payment_method, notes, cost_center, receipt_url, receipt_path, receipt_name,
      receipt_mime_type, created_by, updated_by
    ) values (
      p_store_user_id,
      case when v_import.source_type = 'manual'
        then coalesce(nullif(trim(v_import.raw_ai_response->>'description'), ''), 'Compra manual')
        else trim(concat('Nota de compra', case when v_import.supplier_name is not null then ' - ' || v_import.supplier_name else '' end,
          case when v_import.invoice_number is not null then ' - NF ' || v_import.invoice_number else '' end)) end,
      v_total_amount, coalesce(v_import.expense_category, 'Insumos'),
      coalesce(v_import.invoice_date, current_date), coalesce(v_import.due_date, v_import.invoice_date, current_date),
      v_competence_date,
      case when coalesce(v_import.due_date, v_import.invoice_date, current_date) < current_date then 'overdue' else 'open' end,
      0, 'purchase_invoice', v_import.supplier_name, v_import.invoice_number,
      v_import.payment_method, nullif(trim(v_import.raw_ai_response->>'notes'), ''),
      nullif(trim(v_import.raw_ai_response->>'cost_center'), ''),
      v_import.receipt_url, v_import.attachment_path, v_import.attachment_name,
      v_import.attachment_mime_type, p_store_user_id, p_store_user_id
    ) returning id into v_expense_id;
  end if;

  if p_launch_stock then
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      if not coalesce((v_item->>'control_stock')::boolean, true) then continue; end if;

      select * into v_db_item from public.smart_invoice_import_items
      where id = (v_item->>'id')::uuid and user_id = p_store_user_id for update;
      v_name := v_db_item.normalized_name;
      v_create_sale_product := coalesce((v_item->>'create_sale_product')::boolean, false);
      v_product_updated := false;
      v_ingredient := null;
      v_product := null;

      if v_db_item.ingredient_id is not null then
        select * into v_ingredient from public.ingredients
        where id = v_db_item.ingredient_id and user_id = p_store_user_id for update;
      end if;
      if v_ingredient.id is null then
        select * into v_ingredient from public.ingredients
        where user_id = p_store_user_id and lower(trim(name)) = lower(trim(v_name))
        order by created_at limit 1 for update;
      end if;

      if v_ingredient.id is null then
        insert into public.ingredients (
          user_id, name, category, subcategory, unit, purchase_unit, purchase_conversion,
          yield_percentage, cost_price, price, current_stock, min_stock, stock_controlled, is_active
        ) values (
          p_store_user_id, v_name, v_db_item.category, v_db_item.subcategory, v_db_item.stock_unit,
          v_db_item.unit, v_db_item.conversion_factor, 100, 0, 0, 0, 0, true, true
        ) returning * into v_ingredient;
      else
        update public.ingredients
        set category = coalesce(nullif(v_db_item.category, ''), category),
            subcategory = coalesce(v_db_item.subcategory, subcategory),
            unit = v_db_item.stock_unit, purchase_unit = v_db_item.unit,
            purchase_conversion = v_db_item.conversion_factor, stock_controlled = true,
            updated_at = now()
        where id = v_ingredient.id returning * into v_ingredient;
      end if;

      select public.record_ingredient_purchase(
        v_ingredient.id, v_db_item.quantity, v_db_item.unit_price,
        concat(case when v_import.source_type = 'manual' then 'Entrada pela compra manual ' else 'Entrada pela nota de compra ' end,
          coalesce(v_import.invoice_number, v_import.id::text)), p_store_user_id
      ) into v_purchase_result;

      update public.smart_invoice_import_items
      set ingredient_id = v_ingredient.id,
          stock_quantity_added = coalesce((v_purchase_result->>'stock_added')::numeric, 0)
      where id = v_db_item.id;

      if v_db_item.product_id is not null then
        select * into v_product from public.products
        where id = v_db_item.product_id and user_id = p_store_user_id for update;
      elsif v_create_sale_product then
        select * into v_product from public.products
        where user_id = p_store_user_id and lower(trim(name)) = lower(trim(v_name))
        order by created_at limit 1 for update;
      end if;

      v_product_qty := greatest(coalesce((v_purchase_result->>'stock_added')::numeric,
        v_db_item.quantity * v_db_item.conversion_factor), 0.000001);

      if v_product.id is not null and v_product.track_stock = true then
        update public.products
        set stock_quantity = round(coalesce(stock_quantity, 0) + v_product_qty, 6), updated_at = now()
        where id = v_product.id returning * into v_product;
        v_product_updated := true;
      elsif v_product.id is null and v_create_sale_product then
        v_category_name := coalesce(nullif(trim(v_db_item.category), ''), 'Mercadorias');
        select * into v_category from public.product_categories
        where user_id = p_store_user_id and lower(trim(name)) = lower(v_category_name)
        order by created_at limit 1;
        if v_category.id is null then
          insert into public.product_categories(user_id, name, description, active, display_order)
          values (p_store_user_id, v_category_name, 'Categoria criada a partir de compra.', true,
            coalesce((select max(display_order) + 1 from public.product_categories where user_id = p_store_user_id), 1))
          returning * into v_category;
        end if;
        insert into public.products (
          user_id, name, description, category, category_id, price, available, is_available,
          show_in_pdv, show_in_delivery, track_stock, stock_quantity, low_stock_threshold
        ) values (
          p_store_user_id, v_name, v_db_item.description, v_category.name, v_category.id,
          round(greatest(v_db_item.unit_price * 1.8, 0), 2), true, true, true, false, true, v_product_qty, 5
        ) returning * into v_product;
        v_product_updated := true;
      end if;

      if v_product_updated then
        insert into public.inventory_movements(user_id, product_id, type, quantity)
        values (p_store_user_id, v_product.id, 'purchase', v_product_qty);
        update public.smart_invoice_import_items
        set product_id = v_product.id, product_quantity_added = v_product_qty,
            matched_product_tracks_stock = true
        where id = v_db_item.id;
      end if;

      v_stock_result := v_stock_result || jsonb_build_array(jsonb_build_object(
        'item', v_name, 'ingredient_id', v_ingredient.id,
        'product_id', case when v_product_updated then v_product.id else null end,
        'product_updated', v_product_updated,
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

  return jsonb_build_object('ok', true, 'import_id', v_import.id, 'expense_id', v_expense_id,
    'stock', v_stock_result, 'total_amount', v_total_amount, 'items_total', v_items_total);
end;
$$;

revoke all on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) from public;
grant execute on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) to service_role;

create or replace function public.commit_manual_purchase_import(
  p_store_user_id uuid,
  p_purchase jsonb,
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
  v_import_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_commit_items jsonb := '[]'::jsonb;
  v_total numeric(18,2);
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operação permitida apenas pelo processador seguro de compras.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione ao menos um item à compra manual.';
  end if;
  v_total := greatest(coalesce(nullif(p_purchase->>'total_amount', '')::numeric,
    (select sum(coalesce(nullif(item->>'total_price', '')::numeric, 0)) from jsonb_array_elements(p_items) item), 0), 0);
  if p_launch_expense and v_total <= 0 then raise exception 'Informe o valor total da compra.'; end if;

  insert into public.smart_invoice_imports (
    user_id, source_type, supplier_name, supplier_document, invoice_number, invoice_date,
    due_date, payment_method, total_amount, expense_category, receipt_url,
    attachment_path, attachment_name, attachment_mime_type, attachment_size_bytes,
    raw_ai_response, created_by, updated_by
  ) values (
    p_store_user_id, 'manual', nullif(trim(p_purchase->>'supplier_name'), ''),
    nullif(regexp_replace(coalesce(p_purchase->>'supplier_document', ''), '\D', '', 'g'), ''),
    nullif(trim(p_purchase->>'invoice_number'), ''),
    coalesce(nullif(p_purchase->>'invoice_date', '')::date, current_date),
    nullif(p_purchase->>'due_date', '')::date, nullif(trim(p_purchase->>'payment_method'), ''),
    v_total, coalesce(nullif(trim(p_purchase->>'expense_category'), ''), 'Insumos'),
    nullif(trim(p_purchase->>'receipt_url'), ''), nullif(trim(p_purchase->>'attachment_path'), ''),
    nullif(trim(p_purchase->>'attachment_name'), ''), nullif(trim(p_purchase->>'attachment_mime_type'), ''),
    greatest(coalesce(nullif(p_purchase->>'attachment_size_bytes', '')::bigint, 0), 0),
    coalesce(p_purchase, '{}'::jsonb), p_store_user_id, p_store_user_id
  ) returning id into v_import_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := gen_random_uuid();
    insert into public.smart_invoice_import_items (
      id, import_id, user_id, description, normalized_name, category, subcategory,
      quantity, unit, stock_unit, conversion_factor, unit_price, total_price,
      confidence, similar_to, control_stock, ingredient_id, product_id,
      unit_source, unit_confirmed, inventory_kind, match_confidence,
      matched_product_tracks_stock, create_sale_product
    ) values (
      v_item_id, v_import_id, p_store_user_id,
      coalesce(nullif(trim(v_item->>'description'), ''), nullif(trim(v_item->>'normalized_name'), ''), 'Item'),
      coalesce(nullif(trim(v_item->>'normalized_name'), ''), nullif(trim(v_item->>'description'), ''), 'Item'),
      coalesce(nullif(trim(v_item->>'category'), ''), 'Insumos'), nullif(trim(v_item->>'subcategory'), ''),
      greatest(coalesce(nullif(v_item->>'quantity', '')::numeric, 1), 0.000001),
      coalesce(nullif(v_item->>'unit', ''), 'un'), coalesce(nullif(v_item->>'stock_unit', ''), nullif(v_item->>'unit', ''), 'un'),
      greatest(coalesce(nullif(v_item->>'conversion_factor', '')::numeric, 1), 0.000001),
      greatest(coalesce(nullif(v_item->>'unit_price', '')::numeric, 0), 0),
      greatest(coalesce(nullif(v_item->>'total_price', '')::numeric, 0), 0),
      least(greatest(coalesce(nullif(v_item->>'confidence', '')::numeric, 0), 0), 1),
      nullif(trim(v_item->>'similar_to'), ''), coalesce((v_item->>'control_stock')::boolean, true),
      case when coalesce(v_item->>'ingredient_id', '') ~* '^[0-9a-f-]{36}$' then (v_item->>'ingredient_id')::uuid else null end,
      case when coalesce(v_item->>'product_id', '') ~* '^[0-9a-f-]{36}$' then (v_item->>'product_id')::uuid else null end,
      coalesce(nullif(v_item->>'unit_source', ''), 'confirmed'), coalesce((v_item->>'unit_confirmed')::boolean, true),
      coalesce(nullif(v_item->>'inventory_kind', ''), 'ingredient'),
      least(greatest(coalesce(nullif(v_item->>'match_confidence', '')::numeric, 0), 0), 1),
      coalesce((v_item->>'matched_product_tracks_stock')::boolean, false),
      coalesce((v_item->>'create_sale_product')::boolean, false)
    );
    v_commit_items := v_commit_items || jsonb_build_array(v_item || jsonb_build_object('id', v_item_id));
  end loop;

  select public.commit_purchase_invoice_import(
    v_import_id, p_store_user_id, v_commit_items, p_launch_expense, p_launch_stock
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.commit_manual_purchase_import(uuid, jsonb, jsonb, boolean, boolean) from public;
grant execute on function public.commit_manual_purchase_import(uuid, jsonb, jsonb, boolean, boolean) to service_role;

notify pgrst, 'reload schema';
