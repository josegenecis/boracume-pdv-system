-- Primeiro, atualizar dados existentes se necessário
-- (não há necessidade pois 'cartao' não está sendo usado no novo frontend)

-- Remover constraint antigo se existir
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

-- Adicionar novo constraint com todos os valores possíveis
ALTER TABLE public.orders 
ADD CONSTRAINT orders_payment_method_check 
CHECK (payment_method IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'cartao'));