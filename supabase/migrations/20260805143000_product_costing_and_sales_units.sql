-- Custos hibridos de produto e unidade de venda imutavel no snapshot de CMV.
alter table public.products
  add column if not exists costing_mode text not null default 'automatic_recipe',
  add column if not exists manual_unit_cost numeric(18, 6);

alter table public.products
  drop constraint if exists products_costing_mode_check,
  add constraint products_costing_mode_check
    check (costing_mode in ('automatic_recipe', 'manual')),
  drop constraint if exists products_manual_unit_cost_check,
  add constraint products_manual_unit_cost_check
    check (manual_unit_cost is null or manual_unit_cost >= 0);

comment on column public.products.costing_mode is
  'automatic_recipe usa a ficha tecnica; manual usa o custo direto informado por unidade ou kg.';
comment on column public.products.manual_unit_cost is
  'Custo direto por unidade de venda. Para produtos por peso, representa o custo por kg.';

create or replace function public.capture_order_cmv_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_statuses text[] := array['accepted', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'];
  snapshot_items jsonb := '[]'::jsonb;
  snapshot_total numeric(18, 6) := 0;
  gross_items_total numeric(18, 6) := 0;
  net_products_total numeric(18, 6) := 0;
begin
  if coalesce(new.status, '') <> all(active_statuses)
     or new.items is null
     or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.cmv_calculated_at is not null
     and new.items is not distinct from old.items then
    return new;
  end if;

  select coalesce(sum(
    coalesce(
      nullif(item->>'subtotal', '')::numeric,
      nullif(item->>'total_price', '')::numeric,
      coalesce(nullif(item->>'price', '')::numeric, 0)
        * greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0)
    )
  ), 0)
  into gross_items_total
  from jsonb_array_elements(new.items) item;

  net_products_total := greatest(coalesce(new.total, 0) - coalesce(new.delivery_fee, 0), 0);

  with parsed_items as (
    select
      item_order::integer as item_order,
      case
        when coalesce(item->>'product_id', item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then coalesce(item->>'product_id', item->>'id')::uuid
        else null
      end as product_id,
      coalesce(nullif(item->>'product_name', ''), nullif(item->>'name', ''), 'Produto') as product_name,
      greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0) as quantity,
      case when item->>'sale_unit' in ('un', 'kg') then item->>'sale_unit' else null end as explicit_sale_unit,
      coalesce(
        nullif(item->>'subtotal', '')::numeric,
        nullif(item->>'total_price', '')::numeric,
        coalesce(nullif(item->>'price', '')::numeric, 0)
          * greatest(coalesce(nullif(item->>'quantity', '')::numeric, 1), 0)
      ) as gross_revenue
    from jsonb_array_elements(new.items) with ordinality source(item, item_order)
  ), recipe_costs as (
    select
      recipe.product_id,
      sum(
        recipe.quantity
        * (1 + coalesce(recipe.waste_percentage, 0) / 100)
        * coalesce(ingredient.cost_price, 0)
      )::numeric(18, 6) as unit_cost,
      count(*) as recipe_items
    from public.product_recipes recipe
    join public.ingredients ingredient
      on ingredient.id = recipe.ingredient_id
     and ingredient.user_id = new.user_id
    group by recipe.product_id
  ), resolved as (
    select
      parsed.*,
      coalesce(parsed.explicit_sale_unit, case when product.weight_based then 'kg' else 'un' end) as sale_unit,
      coalesce(recipe.recipe_items, 0) > 0 as has_recipe,
      case
        when product.costing_mode = 'manual' and product.manual_unit_cost is not null then product.manual_unit_cost
        when coalesce(recipe.recipe_items, 0) > 0 then recipe.unit_cost
        when product.manual_unit_cost is not null then product.manual_unit_cost
        else 0
      end as resolved_unit_cost,
      case
        when product.costing_mode = 'manual' and product.manual_unit_cost is not null then 'manual'
        when coalesce(recipe.recipe_items, 0) > 0 then 'recipe'
        when product.manual_unit_cost is not null then 'manual_fallback'
        else 'missing'
      end as cost_source
    from parsed_items parsed
    left join public.products product
      on product.id = parsed.product_id
     and product.user_id = new.user_id
    left join recipe_costs recipe on recipe.product_id = parsed.product_id
  ), calculated as (
    select
      item_order,
      product_id,
      product_name,
      quantity,
      sale_unit,
      round(gross_revenue, 6) as gross_revenue,
      round(
        case when gross_items_total > 0
          then gross_revenue * net_products_total / gross_items_total
          else gross_revenue
        end,
        6
      ) as net_revenue,
      round(coalesce(resolved_unit_cost, 0), 6) as unit_cost,
      round(coalesce(resolved_unit_cost, 0) * quantity, 6) as total_cost,
      has_recipe,
      cost_source,
      cost_source <> 'missing' as has_cost
    from resolved
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'item_order', item_order,
      'product_id', product_id,
      'product_name', product_name,
      'quantity', quantity,
      'sale_unit', sale_unit,
      'gross_revenue', gross_revenue,
      'net_revenue', net_revenue,
      'unit_cost', unit_cost,
      'total_cost', total_cost,
      'has_recipe', has_recipe,
      'has_cost', has_cost,
      'cost_source', cost_source
    ) order by item_order), '[]'::jsonb),
    coalesce(sum(total_cost), 0)::numeric(18, 6)
  into snapshot_items, snapshot_total
  from calculated;

  update public.orders
  set cmv_total = snapshot_total,
      cmv_snapshot = jsonb_build_object(
        'version', 2,
        'captured_at', now(),
        'items', snapshot_items
      ),
      cmv_calculated_at = now()
  where id = new.id;

  return new;
end;
$$;

