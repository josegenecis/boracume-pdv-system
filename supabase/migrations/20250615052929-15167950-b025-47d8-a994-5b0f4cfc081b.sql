-- Verificar dados corrompidos específicos
SELECT id, name, options, 
       CASE 
         WHEN options IS NULL THEN 'NULL'
         WHEN options::text = 'null' THEN 'STRING_NULL'
         WHEN options::text LIKE '"[%' THEN 'STRING_ARRAY'
         WHEN options::text LIKE '[%' THEN 'VALID_JSON'
         ELSE 'OTHER'
       END as format_type
FROM product_variations 
WHERE product_id IN (
  SELECT id FROM products WHERE name LIKE '%Açaí%'
);

-- Corrigir apenas registros específicos com problemas
UPDATE product_variations 
SET options = '[]'::jsonb 
WHERE (options IS NULL OR options::text = 'null') 
  AND product_id IN (SELECT id FROM products WHERE name LIKE '%Açaí%');