ALTER TABLE public.global_variations
ADD COLUMN IF NOT EXISTS customer_label text,
ADD COLUMN IF NOT EXISTS receipt_label text;

ALTER TABLE public.product_variations
ADD COLUMN IF NOT EXISTS customer_label text,
ADD COLUMN IF NOT EXISTS receipt_label text,
ADD COLUMN IF NOT EXISTS display_order integer;

CREATE INDEX IF NOT EXISTS product_variations_product_display_order_idx
ON public.product_variations (product_id, display_order);

