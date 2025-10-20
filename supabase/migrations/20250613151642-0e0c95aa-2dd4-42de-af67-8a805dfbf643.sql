-- Corrigir políticas RLS para permitir acesso anônimo sem verificar profiles

-- Remover políticas problemáticas existentes
DROP POLICY IF EXISTS "Allow anonymous users to create customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous users to read customers for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous users to create orders for digital menu" ON public.orders;
DROP POLICY IF EXISTS "Allow anonymous users to create kitchen orders via trigger" ON public.kitchen_orders;

-- Criar políticas simplificadas para customers
CREATE POLICY "Anonymous users can create customers" 
ON public.customers 
FOR INSERT 
TO anon
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Anonymous users can read customers" 
ON public.customers 
FOR SELECT 
TO anon
USING (user_id IS NOT NULL);

-- Criar política simplificada para orders
CREATE POLICY "Anonymous users can create orders" 
ON public.orders 
FOR INSERT 
TO anon
WITH CHECK (user_id IS NOT NULL);

-- Criar política simplificada para kitchen_orders
CREATE POLICY "Anonymous users can create kitchen orders" 
ON public.kitchen_orders 
FOR INSERT 
TO anon
WITH CHECK (user_id IS NOT NULL);

-- Permitir que usuários anônimos leiam profiles (apenas para verificação básica)
CREATE POLICY "Anonymous users can read basic profile info" 
ON public.profiles 
FOR SELECT 
TO anon
USING (true);