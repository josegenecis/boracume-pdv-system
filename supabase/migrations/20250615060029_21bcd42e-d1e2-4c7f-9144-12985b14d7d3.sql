-- Adicionar campo de bairro na tabela customers se não existir
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS neighborhood text;