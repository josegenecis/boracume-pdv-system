-- Criar tabela para vincular produtos com variações globais
CREATE TABLE public.product_global_variation_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  global_variation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, global_variation_id)
);

-- Enable Row Level Security
ALTER TABLE public.product_global_variation_links ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own product global variation links" 
ON public.product_global_variation_links 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_global_variation_links.product_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own product global variation links" 
ON public.product_global_variation_links 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_global_variation_links.product_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own product global variation links" 
ON public.product_global_variation_links 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.products p 
    WHERE p.id = product_global_variation_links.product_id 
    AND p.user_id = auth.uid()
  )
);