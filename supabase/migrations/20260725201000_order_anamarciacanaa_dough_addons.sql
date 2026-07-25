-- Padroniza a ordem dos grupos de massa e adicionais somente nos produtos do
-- restaurante informado que possuam os dois grupos.
do $$
declare
  v_user_id uuid;
  v_products integer;
  v_local_mass integer;
  v_local_addons integer;
  v_global_mass integer;
  v_global_addons integer;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = 'anamarciacanaa@gmail.com'
   limit 1;

  if v_user_id is null then
    raise exception 'Conta anamarciacanaa@gmail.com não encontrada; nenhuma alteração realizada.';
  end if;

  create temporary table tmp_product_variation_groups
  on commit drop
  as
  select
    product.id as product_id,
    'local'::text as source,
    variation.id as group_id,
    lower(concat_ws(' ', variation.name, variation.customer_label)) as searchable_name,
    coalesce(variation.display_order, 10000) as current_order
  from public.products product
  join public.product_variations variation
    on variation.product_id = product.id
  where product.user_id = v_user_id
    and coalesce(variation.active, true) = true

  union all

  select
    product.id as product_id,
    'global'::text as source,
    link.id as group_id,
    lower(concat_ws(' ', variation.name, variation.customer_label)) as searchable_name,
    coalesce(link.display_order, 10000) as current_order
  from public.products product
  join public.product_global_variation_links link
    on link.product_id = product.id
  join public.global_variations variation
    on variation.id = link.global_variation_id
  where product.user_id = v_user_id
    and coalesce(variation.active, true) = true;

  create temporary table tmp_eligible_products
  on commit drop
  as
  select groups.product_id
  from tmp_product_variation_groups groups
  group by groups.product_id
  having bool_or(
    groups.searchable_name like '%massa%'
    and (
      groups.searchable_name like '%escolh%'
      or groups.searchable_name like '%selec%'
    )
  )
  and bool_or(groups.searchable_name like '%adicion%');

  select count(*)
    into v_products
    from tmp_eligible_products;

  if v_products = 0 then
    raise exception
      'Nenhum produto com os grupos de massa e adicionais foi encontrado; nenhuma alteração realizada.';
  end if;

  -- Posição visual 1: escolha da massa.
  update public.product_variations variation
     set display_order = 0,
         updated_at = now()
    from tmp_product_variation_groups groups
    join tmp_eligible_products eligible
      on eligible.product_id = groups.product_id
   where groups.source = 'local'
     and groups.group_id = variation.id
     and groups.searchable_name like '%massa%'
     and (
       groups.searchable_name like '%escolh%'
       or groups.searchable_name like '%selec%'
     );

  get diagnostics v_local_mass = row_count;

  -- Posição visual 2: adicionais opcionais, entre zero e seis escolhas.
  update public.product_variations variation
     set display_order = 1,
         required = false,
         max_selections = 6,
         allow_paid_excess = false,
         paid_max_selections = 6,
         updated_at = now()
    from tmp_product_variation_groups groups
    join tmp_eligible_products eligible
      on eligible.product_id = groups.product_id
   where groups.source = 'local'
     and groups.group_id = variation.id
     and groups.searchable_name like '%adicion%';

  get diagnostics v_local_addons = row_count;

  update public.product_global_variation_links link
     set display_order = 0
    from tmp_product_variation_groups groups
    join tmp_eligible_products eligible
      on eligible.product_id = groups.product_id
   where groups.source = 'global'
     and groups.group_id = link.id
     and groups.searchable_name like '%massa%'
     and (
       groups.searchable_name like '%escolh%'
       or groups.searchable_name like '%selec%'
     );

  get diagnostics v_global_mass = row_count;

  update public.product_global_variation_links link
     set display_order = 1,
         required = false,
         min_selections = 0,
         max_selections = 6,
         allow_paid_excess = false,
         paid_max_selections = 6
    from tmp_product_variation_groups groups
    join tmp_eligible_products eligible
      on eligible.product_id = groups.product_id
   where groups.source = 'global'
     and groups.group_id = link.id
     and groups.searchable_name like '%adicion%';

  get diagnostics v_global_addons = row_count;

  raise notice
    'Variações padronizadas para anamarciacanaa@gmail.com: % produto(s), massa local %, adicionais locais %, massa global %, adicionais globais %.',
    v_products,
    v_local_mass,
    v_local_addons,
    v_global_mass,
    v_global_addons;
end;
$$;
