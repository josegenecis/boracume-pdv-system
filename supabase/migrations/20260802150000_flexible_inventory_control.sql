-- Controle hibrido de estoque por insumo.
-- O CMV teorico continua vindo da ficha tecnica; esta configuracao define apenas
-- quando o saldo fisico deve ser movimentado.

alter table public.ingredients
  add column if not exists stock_control_mode text not null default 'automatic_recipe';

alter table public.ingredients
  drop constraint if exists ingredients_stock_control_mode_check;

alter table public.ingredients
  add constraint ingredients_stock_control_mode_check
  check (stock_control_mode in ('automatic_recipe', 'manual_withdrawal', 'periodic_count'));

comment on column public.ingredients.stock_control_mode is
  'automatic_recipe: baixa por venda; manual_withdrawal: baixa ao retirar/abrir embalagem; periodic_count: saldo corrigido por contagem fisica.';

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in ('in', 'out', 'loss', 'sale', 'return', 'count_adjustment'));

create or replace function public.record_ingredient_withdrawal(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_quantity_unit text default 'purchase',
  p_reason text default 'Retirada manual do estoque',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := coalesce(auth.uid(), p_owner_id);
  ingredient_row public.ingredients%rowtype;
  stock_quantity numeric;
  next_stock numeric;
begin
  if owner_id is null or p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into ingredient_row from public.ingredients
  where id = p_ingredient_id and user_id = owner_id for update;
  if not found then raise exception 'Insumo nao encontrado'; end if;
  if ingredient_row.stock_control_mode <> 'manual_withdrawal' then
    raise exception 'Este insumo nao esta configurado para retirada manual';
  end if;

  stock_quantity := case
    when p_quantity_unit = 'purchase' then
      p_quantity * ingredient_row.purchase_conversion * ingredient_row.yield_percentage / 100
    when p_quantity_unit = 'consumption' then p_quantity
    else null
  end;
  if stock_quantity is null then raise exception 'Unidade de retirada invalida'; end if;

  next_stock := coalesce(ingredient_row.current_stock, 0) - stock_quantity;
  if next_stock < 0 then raise exception 'Estoque insuficiente. Saldo atual: % %', ingredient_row.current_stock, ingredient_row.unit; end if;

  update public.ingredients set current_stock = next_stock, updated_at = now()
  where id = ingredient_row.id;
  insert into public.stock_movements (
    user_id, ingredient_id, movement_type, quantity, unit_cost, total_cost,
    balance_after, average_cost_after, reason
  ) values (
    owner_id, ingredient_row.id, 'out', stock_quantity, ingredient_row.cost_price,
    round(stock_quantity * ingredient_row.cost_price, 6), next_stock,
    ingredient_row.cost_price, coalesce(nullif(trim(p_reason), ''), 'Retirada manual do estoque')
  );
  return jsonb_build_object('removed_quantity', stock_quantity, 'balance_after', next_stock);
end;
$$;

create or replace function public.record_ingredient_count(
  p_ingredient_id uuid,
  p_counted_quantity numeric,
  p_reason text default 'Inventario por contagem fisica',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := coalesce(auth.uid(), p_owner_id);
  ingredient_row public.ingredients%rowtype;
  difference numeric;
begin
  if owner_id is null or p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'A contagem nao pode ser negativa';
  end if;
  select * into ingredient_row from public.ingredients
  where id = p_ingredient_id and user_id = owner_id for update;
  if not found then raise exception 'Insumo nao encontrado'; end if;
  difference := p_counted_quantity - coalesce(ingredient_row.current_stock, 0);
  update public.ingredients set current_stock = p_counted_quantity, updated_at = now()
  where id = ingredient_row.id;
  insert into public.stock_movements (
    user_id, ingredient_id, movement_type, quantity, unit_cost, total_cost,
    balance_after, average_cost_after, reason
  ) values (
    owner_id, ingredient_row.id, 'count_adjustment', difference,
    ingredient_row.cost_price, round(difference * ingredient_row.cost_price, 6),
    p_counted_quantity, ingredient_row.cost_price,
    coalesce(nullif(trim(p_reason), ''), 'Inventario por contagem fisica')
  );
  return jsonb_build_object('difference', difference, 'balance_after', p_counted_quantity);
end;
$$;

revoke all on function public.record_ingredient_withdrawal(uuid, numeric, text, text, uuid) from public;
grant execute on function public.record_ingredient_withdrawal(uuid, numeric, text, text, uuid) to authenticated, service_role;
revoke all on function public.record_ingredient_count(uuid, numeric, text, uuid) from public;
grant execute on function public.record_ingredient_count(uuid, numeric, text, uuid) to authenticated, service_role;

-- Mantem a rotina central existente e restringe a baixa por venda aos insumos automaticos.
do $$
declare
  original_definition text;
  updated_definition text;
begin
  original_definition := pg_get_functiondef('public.sync_order_stock_accounting()'::regprocedure);
  updated_definition := replace(
    original_definition,
    'join public.ingredients ingredient on ingredient.id = recipe.ingredient_id and ingredient.user_id = new.user_id',
    'join public.ingredients ingredient on ingredient.id = recipe.ingredient_id and ingredient.user_id = new.user_id and ingredient.stock_control_mode = ''automatic_recipe'''
  );
  if updated_definition = original_definition then
    raise exception 'Nao foi possivel aplicar o modo flexivel na rotina de estoque';
  end if;
  execute updated_definition;
end;
$$;
