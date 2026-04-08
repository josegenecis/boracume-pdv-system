WITH payload (user_id, current_name, target_name, customer_label, receipt_label, required, max_selections, options) AS (
  VALUES
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES G COMBO 1',
      'SABORES G',
      'SELECIONE OS SABORES',
      'SABORES G',
      false,
      2,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Calabresa c/ catupiry","price":19},
        {"name":"Calabresa c/ cheddar","price":19},
        {"name":"Calabresa c/ cream cheese","price":22},
        {"name":"Calamista","price":20},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":18.5},
        {"name":"Frango c/ catupiry original","price":22},
        {"name":"Frango c/ cheddar","price":22},
        {"name":"2 queijos original","price":22},
        {"name":"Frango c/ cream cheese original","price":23.5},
        {"name":"Portuguesa","price":18.5},
        {"name":"Hot dog","price":18.5},
        {"name":"Carne de sol","price":24},
        {"name":"Carne de sol c/ cream cheese original","price":28.5},
        {"name":"Carne de sol c/ catupiry","price":24},
        {"name":"A moda house","price":22.5},
        {"name":"Carne de sol c/ catupiry original","price":28},
        {"name":"Carne de sol c/ cheddar","price":24},
        {"name":"Bacon","price":22.5},
        {"name":"Bacon c/ cream cheese","price":28.5},
        {"name":"Bacon c/ catupiry","price":28.5},
        {"name":"Frango c/bacon","price":23},
        {"name":"Lombinho canadense","price":22.5},
        {"name":"Lombinho canadense c/ catupiry original","price":27},
        {"name":"Lombinho c/ cream cheese","price":27}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'SABORES',
      'SELECIONE O SABOR',
      'SABORES',
      false,
      1,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":0},
        {"name":"Hot dog","price":0},
        {"name":"Portuguesa","price":0}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'SABORES GG',
      'SELECIONE OS SABORES',
      'SABORES GG',
      false,
      2,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Calabresa c/ catupiry","price":19},
        {"name":"Calabresa c/ cheddar","price":19},
        {"name":"Calabresa c/ cream cheese","price":22},
        {"name":"Calamista","price":20},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":0},
        {"name":"Frango c/ catupiry original","price":22},
        {"name":"Frango c/ cheddar","price":22},
        {"name":"2 queijos original","price":22},
        {"name":"Frango c/ cream cheese original","price":23.5},
        {"name":"Portuguesa","price":0},
        {"name":"Hot dog","price":18.5},
        {"name":"Carne de sol","price":24},
        {"name":"Carne de sol c/ cream cheese original","price":28.5},
        {"name":"Carne de sol c/ catupiry","price":24},
        {"name":"A moda house","price":22.5},
        {"name":"Carne de sol c/ catupiry original","price":28},
        {"name":"Carne de sol c/ cheddar","price":24},
        {"name":"Bacon","price":22.5},
        {"name":"Bacon c/ cream cheese","price":28.5},
        {"name":"Bacon c/ catupiry","price":28.5},
        {"name":"Frango c/bacon","price":23},
        {"name":"Lombinho canadense","price":22.5},
        {"name":"Lombinho canadense c/ catupiry original","price":27},
        {"name":"Lombinho c/ cream cheese","price":27}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'SABORES DOCE GG',
      'SELECIONE OS SABORES DOCES',
      'SABORES DOCE GG',
      false,
      2,
      $$[
        {"name":"Chocolate ao leite com mms","price":23},
        {"name":"Chocolate ao leite","price":23},
        {"name":"Doce de leite","price":23}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES G DOCE',
      'SABORES DOCES G',
      'SELECIONE OS SABORES DOCES',
      'SABORES DOCES G',
      false,
      2,
      $$[
        {"name":"Chocolate ao leite com mms","price":23},
        {"name":"Chocolate ao leite","price":23},
        {"name":"Doce de leite","price":23}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'SABORES BROTINHO',
      'SELECIONE OS SABORES',
      'SABORES BROTINHO',
      false,
      2,
      $$[
        {"name":"Calabresa","price":10},
        {"name":"Calabresa c/ catupiry","price":12.45},
        {"name":"Mussarela","price":10},
        {"name":"Mista","price":10},
        {"name":"2 queijos","price":10},
        {"name":"Frango","price":10},
        {"name":"Lombinho canadense","price":10},
        {"name":"Portuguesa","price":10},
        {"name":"Carne de sol","price":12.5},
        {"name":"Carne de sol c/ cream cheese","price":12.5},
        {"name":"Frango c/catupiry","price":14.95},
        {"name":"Frango c/cream cheese","price":12.45},
        {"name":"Frango c/cheddar","price":12.45},
        {"name":"Moda house","price":14.95}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'BORDA GG',
      'SELECIONE A BORDA',
      'BORDA GG',
      false,
      1,
      $$[
        {"name":"Borda catupiry sabor requeijão","price":12},
        {"name":"Borda catupiry original","price":15},
        {"name":"Borda cheddar","price":12},
        {"name":"Borda cream cheese original","price":15},
        {"name":"Borda chocolate ao leite","price":15},
        {"name":"Borda vulcão chocolate ao leite","price":26.9},
        {"name":"Borda vulcão chocolate ao leite com mms","price":26.9},
        {"name":"Borda vulcão cheddar","price":26.9},
        {"name":"Borda vulcão catupiry (requeijão)","price":26.9},
        {"name":"Borda vulcão catupiry original","price":26.9}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'BORDA (G)',
      'BORDA G',
      'SELECIONE A BORDA',
      'BORDA G',
      false,
      1,
      $$[
        {"name":"Borda catupiry original","price":12},
        {"name":"Borda catupiry (requeijão)","price":10},
        {"name":"Borda cheddar","price":10},
        {"name":"Borda cream cheese original","price":12},
        {"name":"Borda chocolate ao leite","price":12},
        {"name":"Borda vulcão chocolate ao leite","price":19.9},
        {"name":"Borda vulcão chocolate ao leite com mms","price":19.9},
        {"name":"Borda vulcão cheddar","price":19.9},
        {"name":"Borda vulcão catupiry original","price":19.9},
        {"name":"Borda vulcão catupiry (requeijão)","price":19.9}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'ADICIONAIS (Burguer Artesanal)',
      'ADICIONAIS (BURGUER ARTESANAL)',
      'ADICIONAIS',
      'ADICIONAIS BURGUER',
      false,
      1,
      $$[
        {"name":"Pão árabe","price":2.5},
        {"name":"Carne artesanal da house","price":5},
        {"name":"Ovo","price":3},
        {"name":"Queijo mussarela","price":4},
        {"name":"Cream cheese original","price":3.5},
        {"name":"Molho barbecue","price":2.5},
        {"name":"Catupiry","price":3},
        {"name":"Bacon","price":4.5},
        {"name":"Calabresa","price":4.5},
        {"name":"Presunto","price":3.5}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'ADICIONAIS (ESFIHAS)',
      'ADICIONAIS',
      'ADICIONAIS ESFIHAS',
      false,
      1,
      $$[
        {"name":"Bacon","price":1.5},
        {"name":"Catupiry","price":1.5},
        {"name":"Requeijão","price":1.5},
        {"name":"Cheddar","price":1.5},
        {"name":"Queijo","price":1.5},
        {"name":"Cream cheese original","price":1.5},
        {"name":"Escolha o termo carne","price":0}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      NULL,
      'ADICIONAIS',
      'ADICIONAIS EXTRAS',
      'ADICIONAIS',
      false,
      3,
      $$[
        {"name":"Catupiry","price":6},
        {"name":"Cheddar","price":6},
        {"name":"Cream cheese original","price":12},
        {"name":"Bacon","price":12},
        {"name":"Molho de tomate","price":2},
        {"name":"Mussarela","price":12},
        {"name":"Azeitona","price":2},
        {"name":"Ovos","price":3},
        {"name":"Milho","price":2},
        {"name":"Cebola","price":2}
      ]$$::jsonb
    )
)
UPDATE public.global_variations gv
SET
  name = payload.target_name,
  customer_label = payload.customer_label,
  receipt_label = payload.receipt_label,
  required = payload.required,
  max_selections = payload.max_selections,
  options = payload.options,
  updated_at = now()
FROM payload
WHERE gv.user_id = payload.user_id
  AND gv.name = COALESCE(payload.current_name, payload.target_name);

WITH payload (user_id, target_name, customer_label, receipt_label, required, max_selections, options) AS (
  VALUES
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES G',
      'SELECIONE OS SABORES',
      'SABORES G',
      false,
      2,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Calabresa c/ catupiry","price":19},
        {"name":"Calabresa c/ cheddar","price":19},
        {"name":"Calabresa c/ cream cheese","price":22},
        {"name":"Calamista","price":20},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":18.5},
        {"name":"Frango c/ catupiry original","price":22},
        {"name":"Frango c/ cheddar","price":22},
        {"name":"2 queijos original","price":22},
        {"name":"Frango c/ cream cheese original","price":23.5},
        {"name":"Portuguesa","price":18.5},
        {"name":"Hot dog","price":18.5},
        {"name":"Carne de sol","price":24},
        {"name":"Carne de sol c/ cream cheese original","price":28.5},
        {"name":"Carne de sol c/ catupiry","price":24},
        {"name":"A moda house","price":22.5},
        {"name":"Carne de sol c/ catupiry original","price":28},
        {"name":"Carne de sol c/ cheddar","price":24},
        {"name":"Bacon","price":22.5},
        {"name":"Bacon c/ cream cheese","price":28.5},
        {"name":"Bacon c/ catupiry","price":28.5},
        {"name":"Frango c/bacon","price":23},
        {"name":"Lombinho canadense","price":22.5},
        {"name":"Lombinho canadense c/ catupiry original","price":27},
        {"name":"Lombinho c/ cream cheese","price":27}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES',
      'SELECIONE O SABOR',
      'SABORES',
      false,
      1,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":0},
        {"name":"Hot dog","price":0},
        {"name":"Portuguesa","price":0}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES GG',
      'SELECIONE OS SABORES',
      'SABORES GG',
      false,
      2,
      $$[
        {"name":"Calabresa","price":0},
        {"name":"Calabresa c/ catupiry","price":19},
        {"name":"Calabresa c/ cheddar","price":19},
        {"name":"Calabresa c/ cream cheese","price":22},
        {"name":"Calamista","price":20},
        {"name":"Mista","price":0},
        {"name":"Mussarela","price":0},
        {"name":"Frango","price":0},
        {"name":"Frango c/ catupiry original","price":22},
        {"name":"Frango c/ cheddar","price":22},
        {"name":"2 queijos original","price":22},
        {"name":"Frango c/ cream cheese original","price":23.5},
        {"name":"Portuguesa","price":0},
        {"name":"Hot dog","price":18.5},
        {"name":"Carne de sol","price":24},
        {"name":"Carne de sol c/ cream cheese original","price":28.5},
        {"name":"Carne de sol c/ catupiry","price":24},
        {"name":"A moda house","price":22.5},
        {"name":"Carne de sol c/ catupiry original","price":28},
        {"name":"Carne de sol c/ cheddar","price":24},
        {"name":"Bacon","price":22.5},
        {"name":"Bacon c/ cream cheese","price":28.5},
        {"name":"Bacon c/ catupiry","price":28.5},
        {"name":"Frango c/bacon","price":23},
        {"name":"Lombinho canadense","price":22.5},
        {"name":"Lombinho canadense c/ catupiry original","price":27},
        {"name":"Lombinho c/ cream cheese","price":27}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES DOCE GG',
      'SELECIONE OS SABORES DOCES',
      'SABORES DOCE GG',
      false,
      2,
      $$[
        {"name":"Chocolate ao leite com mms","price":23},
        {"name":"Chocolate ao leite","price":23},
        {"name":"Doce de leite","price":23}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES DOCES G',
      'SELECIONE OS SABORES DOCES',
      'SABORES DOCES G',
      false,
      2,
      $$[
        {"name":"Chocolate ao leite com mms","price":23},
        {"name":"Chocolate ao leite","price":23},
        {"name":"Doce de leite","price":23}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'SABORES BROTINHO',
      'SELECIONE OS SABORES',
      'SABORES BROTINHO',
      false,
      2,
      $$[
        {"name":"Calabresa","price":10},
        {"name":"Calabresa c/ catupiry","price":12.45},
        {"name":"Mussarela","price":10},
        {"name":"Mista","price":10},
        {"name":"2 queijos","price":10},
        {"name":"Frango","price":10},
        {"name":"Lombinho canadense","price":10},
        {"name":"Portuguesa","price":10},
        {"name":"Carne de sol","price":12.5},
        {"name":"Carne de sol c/ cream cheese","price":12.5},
        {"name":"Frango c/catupiry","price":14.95},
        {"name":"Frango c/cream cheese","price":12.45},
        {"name":"Frango c/cheddar","price":12.45},
        {"name":"Moda house","price":14.95}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'BORDA GG',
      'SELECIONE A BORDA',
      'BORDA GG',
      false,
      1,
      $$[
        {"name":"Borda catupiry sabor requeijão","price":12},
        {"name":"Borda catupiry original","price":15},
        {"name":"Borda cheddar","price":12},
        {"name":"Borda cream cheese original","price":15},
        {"name":"Borda chocolate ao leite","price":15},
        {"name":"Borda vulcão chocolate ao leite","price":26.9},
        {"name":"Borda vulcão chocolate ao leite com mms","price":26.9},
        {"name":"Borda vulcão cheddar","price":26.9},
        {"name":"Borda vulcão catupiry (requeijão)","price":26.9},
        {"name":"Borda vulcão catupiry original","price":26.9}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'BORDA G',
      'SELECIONE A BORDA',
      'BORDA G',
      false,
      1,
      $$[
        {"name":"Borda catupiry original","price":12},
        {"name":"Borda catupiry (requeijão)","price":10},
        {"name":"Borda cheddar","price":10},
        {"name":"Borda cream cheese original","price":12},
        {"name":"Borda chocolate ao leite","price":12},
        {"name":"Borda vulcão chocolate ao leite","price":19.9},
        {"name":"Borda vulcão chocolate ao leite com mms","price":19.9},
        {"name":"Borda vulcão cheddar","price":19.9},
        {"name":"Borda vulcão catupiry original","price":19.9},
        {"name":"Borda vulcão catupiry (requeijão)","price":19.9}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'ADICIONAIS (BURGUER ARTESANAL)',
      'ADICIONAIS',
      'ADICIONAIS BURGUER',
      false,
      1,
      $$[
        {"name":"Pão árabe","price":2.5},
        {"name":"Carne artesanal da house","price":5},
        {"name":"Ovo","price":3},
        {"name":"Queijo mussarela","price":4},
        {"name":"Cream cheese original","price":3.5},
        {"name":"Molho barbecue","price":2.5},
        {"name":"Catupiry","price":3},
        {"name":"Bacon","price":4.5},
        {"name":"Calabresa","price":4.5},
        {"name":"Presunto","price":3.5}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'ADICIONAIS (ESFIHAS)',
      'ADICIONAIS',
      'ADICIONAIS ESFIHAS',
      false,
      1,
      $$[
        {"name":"Bacon","price":1.5},
        {"name":"Catupiry","price":1.5},
        {"name":"Requeijão","price":1.5},
        {"name":"Cheddar","price":1.5},
        {"name":"Queijo","price":1.5},
        {"name":"Cream cheese original","price":1.5},
        {"name":"Escolha o termo carne","price":0}
      ]$$::jsonb
    ),
    (
      '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid,
      'ADICIONAIS',
      'ADICIONAIS EXTRAS',
      'ADICIONAIS',
      false,
      3,
      $$[
        {"name":"Catupiry","price":6},
        {"name":"Cheddar","price":6},
        {"name":"Cream cheese original","price":12},
        {"name":"Bacon","price":12},
        {"name":"Molho de tomate","price":2},
        {"name":"Mussarela","price":12},
        {"name":"Azeitona","price":2},
        {"name":"Ovos","price":3},
        {"name":"Milho","price":2},
        {"name":"Cebola","price":2}
      ]$$::jsonb
    )
)
INSERT INTO public.global_variations (
  user_id,
  name,
  options,
  description,
  customer_label,
  receipt_label,
  required,
  max_selections,
  active,
  created_at,
  updated_at
)
SELECT
  payload.user_id,
  payload.target_name,
  payload.options,
  '',
  payload.customer_label,
  payload.receipt_label,
  payload.required,
  payload.max_selections,
  true,
  now(),
  now()
FROM payload
WHERE NOT EXISTS (
  SELECT 1
  FROM public.global_variations gv
  WHERE gv.user_id = payload.user_id
    AND gv.name = payload.target_name
);

SELECT
  user_id,
  name,
  customer_label,
  receipt_label,
  jsonb_array_length(options) AS qtd_opcoes
FROM public.global_variations
WHERE user_id = '6a6ed138-b4cb-4395-a0a7-2ff377528bd2'::uuid
  AND name IN (
    'SABORES G',
    'SABORES',
    'SABORES GG',
    'SABORES DOCE GG',
    'SABORES DOCES G',
    'SABORES BROTINHO',
    'BORDA GG',
    'BORDA G',
    'ADICIONAIS (BURGUER ARTESANAL)',
    'ADICIONAIS (ESFIHAS)',
    'ADICIONAIS'
  )
ORDER BY name;
