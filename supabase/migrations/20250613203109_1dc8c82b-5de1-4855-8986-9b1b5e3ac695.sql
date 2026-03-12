-- Habilitar RLS para global_variations
ALTER TABLE public.global_variations ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own global variations" ON public.global_variations;
DROP POLICY IF EXISTS "Users can create their own global variations" ON public.global_variations;
DROP POLICY IF EXISTS "Users can update their own global variations" ON public.global_variations;
DROP POLICY IF EXISTS "Users can delete their own global variations" ON public.global_variations;

-- Criar políticas para global_variations
CREATE POLICY "Users can view their own global variations"
ON public.global_variations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own global variations"
ON public.global_variations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own global variations"
ON public.global_variations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own global variations"
ON public.global_variations
FOR DELETE
USING (auth.uid() = user_id);

-- Habilitar RLS para product_global_variation_links
ALTER TABLE public.product_global_variation_links ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own product variation links" ON public.product_global_variation_links;
DROP POLICY IF EXISTS "Users can create links for their own products" ON public.product_global_variation_links;
DROP POLICY IF EXISTS "Users can update links for their own products" ON public.product_global_variation_links;
DROP POLICY IF EXISTS "Users can delete links for their own products" ON public.product_global_variation_links;

-- Criar políticas para product_global_variation_links
CREATE POLICY "Users can view their own product variation links"
ON public.product_global_variation_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create links for their own products"
ON public.product_global_variation_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update links for their own products"
ON public.product_global_variation_links
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete links for their own products"
ON public.product_global_variation_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_id AND p.user_id = auth.uid()
  )
);