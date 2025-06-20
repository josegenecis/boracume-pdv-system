
-- Adicionar campos faltantes na tabela orders para suportar funcionalidades de checkout
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_address_reference text,
ADD COLUMN IF NOT EXISTS customer_neighborhood text;

-- Adicionar comentários para documentar os novos campos
COMMENT ON COLUMN public.orders.customer_address_reference IS 'Ponto de referência do endereço do cliente';
COMMENT ON COLUMN public.orders.customer_neighborhood IS 'Bairro do endereço do cliente';
