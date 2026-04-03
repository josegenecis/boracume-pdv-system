CREATE OR REPLACE FUNCTION public.normalize_complement_option_name(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH prepared AS (
    SELECT btrim(regexp_replace(COALESCE(input_text, ''), '\s+', ' ', 'g')) AS value
  )
  SELECT CASE
    WHEN value = '' THEN ''
    ELSE upper(left(lower(value), 1)) || substr(lower(value), 2)
  END
  FROM prepared;
$$;

UPDATE public.global_variations gv
SET options = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(option_item) = 'object' THEN
        jsonb_set(
          option_item,
          '{name}',
          to_jsonb(public.normalize_complement_option_name(option_item->>'name')),
          true
        )
      ELSE option_item
    END
  )
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(gv.options) = 'array' THEN gv.options
      ELSE '[]'::jsonb
    END
  ) AS option_item
), '[]'::jsonb);

UPDATE public.product_variations pv
SET options = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(option_item) = 'object' THEN
        jsonb_set(
          option_item,
          '{name}',
          to_jsonb(public.normalize_complement_option_name(option_item->>'name')),
          true
        )
      ELSE option_item
    END
  )
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(pv.options) = 'array' THEN pv.options
      ELSE '[]'::jsonb
    END
  ) AS option_item
), '[]'::jsonb);

UPDATE public.product_global_variation_links link
SET option_price_overrides = COALESCE((
  SELECT jsonb_object_agg(
    public.normalize_complement_option_name(option_key),
    CASE
      WHEN jsonb_typeof(option_value) = 'object' THEN
        jsonb_set(
          option_value,
          '{label}',
          to_jsonb(public.normalize_complement_option_name(option_value->>'label')),
          true
        )
      ELSE option_value
    END
  )
  FROM jsonb_each(
    CASE
      WHEN jsonb_typeof(link.option_price_overrides) = 'object' THEN link.option_price_overrides
      ELSE '{}'::jsonb
    END
  ) AS overrides(option_key, option_value)
), '{}'::jsonb)
WHERE link.option_price_overrides IS NOT NULL;
