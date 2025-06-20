
-- Corrigir políticas RLS conflitantes na tabela profiles
-- Remover todas as políticas existentes e criar apenas as essenciais

-- Remover políticas conflitantes existentes
DROP POLICY IF EXISTS "Public profiles are viewable for digital menu" ON public.profiles;
DROP POLICY IF EXISTS "Users can view and edit their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous access to profiles for digital menu" ON public.profiles;
DROP POLICY IF EXISTS "Anonymous users can read basic profile info" ON public.profiles;

-- Criar políticas simplificadas e funcionais
-- 1. Permitir acesso anônimo para leitura (cardápio digital)
CREATE POLICY "Anonymous can read profiles for menu" 
ON public.profiles 
FOR SELECT 
TO anon, authenticated
USING (true);

-- 2. Usuários autenticados podem ver e editar seu próprio perfil
CREATE POLICY "Users can manage own profile" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Sistema pode criar perfis para novos usuários (trigger)
CREATE POLICY "System can create profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated, service_role
WITH CHECK (true);

-- Corrigir políticas da tabela orders
-- Remover políticas conflitantes
DROP POLICY IF EXISTS "Anonymous users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anonymous users can create orders for digital menu" ON public.orders;

-- Criar política simplificada para orders
CREATE POLICY "Allow order creation" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

-- Política para usuários autenticados verem seus pedidos
CREATE POLICY "Users can view own orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Corrigir políticas da tabela customers
-- Remover políticas conflitantes
DROP POLICY IF EXISTS "Anonymous users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;

-- Criar políticas simplificadas para customers
CREATE POLICY "Allow customer creation" 
ON public.customers 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Users can view own customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
