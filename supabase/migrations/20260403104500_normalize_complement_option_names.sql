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

CREATE OR REPLACE FUNCTION public.normalize_complement_options_json(input_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  options_array jsonb;
BEGIN
  IF input_value IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF jsonb_typeof(input_value) = 'array' THEN
    options_array := input_value;
  ELSIF jsonb_typeof(input_value) = 'string' THEN
    BEGIN
      options_array := (input_value #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      options_array := '[]'::jsonb;
    END;
  ELSE
    options_array := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(options_array) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
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
    FROM jsonb_array_elements(options_array) AS option_item
  ), '[]'::jsonb);
END;
$$;

UPDATE public.global_variations gv
SET options = public.normalize_complement_options_json(gv.options);

UPDATE public.product_variations pv
SET options = public.normalize_complement_options_json(pv.options);

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
