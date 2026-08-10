-- Persistencia confiavel da ficha tecnica, inclusive para operadores e lojas em rede.
create or replace function public.save_product_recipe(
  p_product_id uuid,
  p_ingredient_id uuid,
  p_quantity numeric,
  p_waste_percentage numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  product_owner uuid;
  saved_recipe public.product_recipes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Entre novamente no sistema.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade da ficha deve ser maior que zero.';
  end if;
  if coalesce(p_waste_percentage, 0) < 0 or coalesce(p_waste_percentage, 0) > 100 then
    raise exception 'A perda deve ficar entre 0 e 100 por cento.';
  end if;

  select user_id into product_owner
  from public.products
  where id = p_product_id;

  if product_owner is null then
    raise exception 'Produto nao encontrado.';
  end if;
  if auth.uid() <> product_owner and not public.can_access_store(product_owner) then
    raise exception 'Sem permissao para alterar a ficha tecnica desta loja.';
  end if;
  if not exists (
    select 1 from public.ingredients
    where id = p_ingredient_id and user_id = product_owner
  ) then
    raise exception 'O insumo nao pertence a mesma loja do produto.';
  end if;

  insert into public.product_recipes (
    product_id, ingredient_id, quantity, waste_percentage
  ) values (
    p_product_id, p_ingredient_id, round(p_quantity, 6), round(coalesce(p_waste_percentage, 0), 4)
  )
  on conflict (product_id, ingredient_id) do update
  set quantity = excluded.quantity,
      waste_percentage = excluded.waste_percentage
  returning * into saved_recipe;

  return jsonb_build_object(
    'id', saved_recipe.id,
    'product_id', saved_recipe.product_id,
    'ingredient_id', saved_recipe.ingredient_id,
    'quantity', saved_recipe.quantity,
    'waste_percentage', saved_recipe.waste_percentage
  );
end;
$$;

revoke all on function public.save_product_recipe(uuid, uuid, numeric, numeric) from public;
grant execute on function public.save_product_recipe(uuid, uuid, numeric, numeric) to authenticated, service_role;

