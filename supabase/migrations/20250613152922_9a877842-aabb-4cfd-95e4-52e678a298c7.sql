-- Solução temporária: desabilitar RLS na tabela orders para debug
-- Isso vai permitir inserções anônimas temporariamente
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- Verificar se há outras tabelas relacionadas que precisam de ajuste
ALTER TABLE public.kitchen_orders DISABLE ROW LEVEL SECURITY;

-- Manter RLS em customers mas com política mais permissiva
DROP POLICY IF EXISTS "Anonymous users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anonymous users can read customers" ON public.customers;

CREATE POLICY "Allow all operations for customers" 
ON public.customers 
FOR ALL 
TO anon, authenticated
USING (true)
WITH CHECK (true);