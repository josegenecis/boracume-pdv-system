-- Fluxo profissional e transacional para notas de compra.
-- O lançamento e o estorno passam a ser operações atômicas e auditáveis.

alter table public.smart_invoice_imports
  drop constraint if exists smart_invoice_imports_source_type_check;

alter table public.smart_invoice_imports
  add constraint smart_invoice_imports_source_type_check
  check (source_type in ('image', 'pdf', 'xml')),
  add column if not exists document_key text,
  add column if not exists launch_expense boolean not null default true,
  add column if not exists launch_stock boolean not null default true,
  add column if not exists committed_at timestamptz,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists reversed_by uuid references auth.users(id) on delete set null,
  add column if not exists reversed_by_waiter_id uuid references public.waiters(id) on delete set null,
  add column if not exists reversed_by_name text;

alter table public.smart_invoice_import_items
  add column if not exists stock_quantity_added numeric(18, 6) not null default 0,
  add column if not exists product_quantity_added integer not null default 0;

create index if not exists smart_invoice_imports_user_status_created_idx
  on public.smart_invoice_imports(user_id, status, created_at desc);

create unique index if not exists smart_invoice_imports_user_document_key_uidx
  on public.smart_invoice_imports(user_id, document_key)
  where document_key is not null and document_key <> '';

-- Garante acesso às lojas selecionadas mesmo em ambientes em que a política
-- automática de rede foi criada antes destas tabelas.
drop policy if exists smart_invoice_imports_store_access on public.smart_invoice_imports;
create policy smart_invoice_imports_store_access
  on public.smart_invoice_imports for all to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));

drop policy if exists smart_invoice_import_items_store_access on public.smart_invoice_import_items;
create policy smart_invoice_import_items_store_access
  on public.smart_invoice_import_items for all to authenticated
  using (public.can_access_store(user_id))
  with check (public.can_access_store(user_id));

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/xml', 'text/xml']
where id = 'purchase-invoice-attachments';

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
  v_unit text;
  v_quantity numeric(18,6);
  v_unit_price numeric(18,6);
  v_total numeric(18,6);
  v_total_amount numeric(18,2) := 0;
  v_product_qty integer;
  v_purchase_result jsonb;
  v_stock_result jsonb := '[]'::jsonb;
  v_create_sale_product boolean;
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

  select * into v_import
  from public.smart_invoice_imports
  where id = p_import_id and user_id = p_store_user_id
  for update;

  if not found then raise exception 'Nota de compra não encontrada.'; end if;
  if v_import.status = 'committed' then raise exception 'Esta nota já foi lançada.'; end if;
  if v_import.status = 'cancelled' then raise exception 'Uma nota estornada não pode ser lançada novamente.'; end if;

  -- Primeiro valida e persiste toda a conferência dos itens.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'id', '') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Um item da nota não possui identificação válida.';
    end if;
    select * into v_db_item
    from public.smart_invoice_import_items
    where id = (v_item->>'id')::uuid
      and import_id = p_import_id
      and user_id = p_store_user_id
    for update;
    if not found then raise exception 'Item da nota não encontrado.'; end if;

    v_name := nullif(trim(coalesce(v_item->>'normalized_name', v_item->>'description', '')), '');
    v_description := coalesce(nullif(trim(v_item->>'description'), ''), v_name);
    v_category_name := coalesce(nullif(trim(v_item->>'category'), ''), 'Insumos');
    v_subcategory := nullif(trim(v_item->>'subcategory'), '');
    v_unit := case lower(coalesce(v_item->>'stock_unit', v_item->>'unit', 'un'))
      when 'kg' then 'kg' when 'g' then 'g' when 'l' then 'l' when 'ml' then 'ml' else 'un' end;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_unit_price := greatest(coalesce(nullif(v_item->>'unit_price', '')::numeric, 0), 0);
    v_total := round(coalesce(nullif(v_item->>'total_price', '')::numeric, v_quantity * v_unit_price), 2);

    if v_name is null then raise exception 'Informe o nome de todos os itens.'; end if;
    if v_quantity <= 0 then raise exception 'A quantidade de % deve ser maior que zero.', v_name; end if;
    if v_total < 0 then raise exception 'O total de % não pode ser negativo.', v_name; end if;

    update public.smart_invoice_import_items
    set description = v_description,
        normalized_name = v_name,
        category = v_category_name,
        subcategory = v_subcategory,
        quantity = v_quantity,
        unit = v_unit,
        stock_unit = v_unit,
        unit_price = v_unit_price,
        total_price = v_total,
        control_stock = coalesce((v_item->>'control_stock')::boolean, true)
    where id = v_db_item.id;

    v_total_amount := v_total_amount + v_total;
  end loop;

  if v_total_amount <= 0 then v_total_amount := coalesce(v_import.total_amount, 0); end if;
  if v_total_amount <= 0 then raise exception 'O total da nota deve ser maior que zero.'; end if;

  if p_launch_expense then
    insert into public.expenses (
      user_id, description, amount, category, expense_date, due_date, status,
      supplier_name, document_number, receipt_url, receipt_path, receipt_name, receipt_mime_type
    ) values (
      p_store_user_id,
      trim(concat('Nota de compra', case when v_import.supplier_name is not null then ' - ' || v_import.supplier_name else '' end,
        case when v_import.invoice_number is not null then ' - NF ' || v_import.invoice_number else '' end)),
      v_total_amount, coalesce(v_import.expense_category, 'insumos'), coalesce(v_import.invoice_date, current_date),
      coalesce(v_import.invoice_date, current_date), 'pending', v_import.supplier_name, v_import.invoice_number,
      v_import.receipt_url, v_import.attachment_path, v_import.attachment_name, v_import.attachment_mime_type
    ) returning id into v_expense_id;
  end if;

  if p_launch_stock then
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      if not coalesce((v_item->>'control_stock')::boolean, true) then continue; end if;

      select * into v_db_item from public.smart_invoice_import_items where id = (v_item->>'id')::uuid for update;
      v_name := v_db_item.normalized_name;
      v_create_sale_product := coalesce((v_item->>'create_sale_product')::boolean, false);

      select * into v_ingredient
      from public.ingredients
      where user_id = p_store_user_id and lower(trim(name)) = lower(trim(v_name))
      order by created_at limit 1 for update;

      if not found then
        insert into public.ingredients (
          user_id, name, category, subcategory, unit, purchase_unit, purchase_conversion,
          yield_percentage, cost_price, price, current_stock, min_stock, stock_controlled, is_active
        ) values (
          p_store_user_id, v_name, v_db_item.category, v_db_item.subcategory, v_db_item.stock_unit,
          v_db_item.unit, 1, 100, 0, 0, 0, 0, true, true
        ) returning * into v_ingredient;
      else
        update public.ingredients
        set category = v_db_item.category,
            subcategory = coalesce(v_db_item.subcategory, subcategory),
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
        v_product_qty := greatest(1, floor(v_db_item.quantity)::integer);
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
        'quantity', coalesce((v_purchase_result->>'stock_added')::numeric, 0)
      ));
    end loop;
  end if;

  update public.smart_invoice_imports
  set status = 'committed', expense_id = v_expense_id, total_amount = v_total_amount,
      launch_expense = p_launch_expense, launch_stock = p_launch_stock,
      committed_at = now(), updated_at = now()
  where id = v_import.id;

  return jsonb_build_object('ok', true, 'expense_id', v_expense_id, 'stock', v_stock_result, 'total_amount', v_total_amount);
end;
$$;

revoke all on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) from public;
grant execute on function public.commit_purchase_invoice_import(uuid, uuid, jsonb, boolean, boolean) to service_role;

create or replace function public.reverse_purchase_invoice_authorized(
  p_import_id uuid,
  p_store_user_id uuid,
  p_reason text,
  p_admin_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.smart_invoice_imports%rowtype;
  v_item public.smart_invoice_import_items%rowtype;
  v_ingredient public.ingredients%rowtype;
  v_product public.products%rowtype;
  v_waiter_id uuid;
  v_waiter_name text;
  v_next_stock numeric(18,6);
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre novamente.'; end if;
  if not public.can_access_store(p_store_user_id) then raise exception 'Você não possui acesso a esta loja.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Informe o motivo do estorno.'; end if;
  if nullif(trim(coalesce(p_admin_pin, '')), '') is null then raise exception 'Informe o PIN do administrador.'; end if;

  select waiter.id, waiter.name into v_waiter_id, v_waiter_name
  from public.waiters waiter
  where waiter.user_id = p_store_user_id and waiter.active = true and waiter.pin = trim(p_admin_pin)
    and (waiter.role = 'admin' or coalesce((waiter.permissions->>'admin')::boolean, false))
  order by waiter.created_at limit 1;
  if v_waiter_id is null then raise exception 'PIN inválido ou operador sem permissão de administrador.'; end if;

  select * into v_import from public.smart_invoice_imports
  where id = p_import_id and user_id = p_store_user_id for update;
  if not found then raise exception 'Nota de compra não encontrada.'; end if;
  if v_import.status = 'cancelled' then raise exception 'Esta nota já foi estornada.'; end if;
  if v_import.status <> 'committed' then raise exception 'Somente notas lançadas podem ser estornadas.'; end if;

  -- Bloqueia todas as linhas e valida antes de alterar qualquer saldo.
  for v_item in select * from public.smart_invoice_import_items where import_id = v_import.id order by created_at for update
  loop
    if v_item.ingredient_id is not null and v_item.stock_quantity_added > 0 then
      select * into v_ingredient from public.ingredients
      where id = v_item.ingredient_id and user_id = p_store_user_id for update;
      if not found then raise exception 'O insumo % vinculado à nota não existe mais.', v_item.normalized_name; end if;
      if coalesce(v_ingredient.current_stock, 0) < v_item.stock_quantity_added then
        raise exception 'Estoque insuficiente para estornar %. Disponível: %, entrada da nota: %.',
          v_item.normalized_name, v_ingredient.current_stock, v_item.stock_quantity_added;
      end if;
    end if;
    if v_item.product_id is not null and v_item.product_quantity_added > 0 then
      select * into v_product from public.products
      where id = v_item.product_id and user_id = p_store_user_id for update;
      if not found then raise exception 'O produto % vinculado à nota não existe mais.', v_item.normalized_name; end if;
      if coalesce(v_product.stock_quantity, 0) < v_item.product_quantity_added then
        raise exception 'Estoque do produto % é insuficiente para o estorno.', v_item.normalized_name;
      end if;
    end if;
  end loop;

  for v_item in select * from public.smart_invoice_import_items where import_id = v_import.id order by created_at
  loop
    if v_item.ingredient_id is not null and v_item.stock_quantity_added > 0 then
      select * into v_ingredient from public.ingredients where id = v_item.ingredient_id for update;
      v_next_stock := round(coalesce(v_ingredient.current_stock, 0) - v_item.stock_quantity_added, 6);
      update public.ingredients set current_stock = v_next_stock, updated_at = now() where id = v_ingredient.id;
      insert into public.stock_movements(
        user_id, ingredient_id, movement_type, quantity, unit_cost, total_cost,
        balance_after, average_cost_after, reason
      ) values (
        p_store_user_id, v_ingredient.id, 'out', v_item.stock_quantity_added,
        v_ingredient.cost_price, round(v_item.stock_quantity_added * v_ingredient.cost_price, 6),
        v_next_stock, v_ingredient.cost_price,
        concat('Estorno da nota de compra ', coalesce(v_import.invoice_number, v_import.id::text), ': ', trim(p_reason))
      );
    end if;
    if v_item.product_id is not null and v_item.product_quantity_added > 0 then
      update public.products
      set stock_quantity = stock_quantity - v_item.product_quantity_added, updated_at = now()
      where id = v_item.product_id;
      insert into public.inventory_movements(user_id, product_id, type, quantity)
      values (p_store_user_id, v_item.product_id, 'adjustment', -v_item.product_quantity_added);
    end if;
  end loop;

  if v_import.expense_id is not null then
    update public.expenses
    set is_active = false, reversed_at = now(), reversal_reason = trim(p_reason),
        reversed_by = auth.uid(), reversed_by_waiter_id = v_waiter_id, reversed_by_name = v_waiter_name
    where id = v_import.expense_id and user_id = p_store_user_id and is_active = true;
  end if;

  update public.smart_invoice_imports
  set status = 'cancelled', reversed_at = now(), reversal_reason = trim(p_reason),
      reversed_by = auth.uid(), reversed_by_waiter_id = v_waiter_id,
      reversed_by_name = v_waiter_name, updated_at = now()
  where id = v_import.id;

  return jsonb_build_object('ok', true, 'import_id', v_import.id, 'reversed_at', now(), 'reversed_by_name', v_waiter_name);
end;
$$;

revoke all on function public.reverse_purchase_invoice_authorized(uuid, uuid, text, text) from public;
grant execute on function public.reverse_purchase_invoice_authorized(uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
