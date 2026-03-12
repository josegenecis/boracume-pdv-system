-- Função para atualizar updated_at (criar primeiro)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela de clientes para cadastro automático
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Índice único para evitar duplicatas por telefone dentro do mesmo restaurante
  UNIQUE(user_id, phone)
);

-- Habilitar RLS na tabela customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção de clientes por usuários anônimos
CREATE POLICY "Allow anonymous users to create customers" 
ON public.customers 
FOR INSERT 
TO anon
WITH CHECK (
  user_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id
  )
);

-- Política para permitir leitura de clientes por usuários anônimos (para verificar se existe)
CREATE POLICY "Allow anonymous users to read customers for digital menu" 
ON public.customers 
FOR SELECT 
TO anon
USING (
  user_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id
  )
);

-- Adicionar coluna customer_id na tabela orders para relacionar com cliente
ALTER TABLE public.orders ADD COLUMN customer_id uuid REFERENCES public.customers(id);

-- Criar trigger para atualizar updated_at na tabela customers
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();