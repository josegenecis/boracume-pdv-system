-- Limpar dados de variações globais para resolver conflitos
-- Remover links entre produtos e variações globais
DELETE FROM public.product_global_variation_links;

-- Remover todas as variações globais
DELETE FROM public.global_variations;