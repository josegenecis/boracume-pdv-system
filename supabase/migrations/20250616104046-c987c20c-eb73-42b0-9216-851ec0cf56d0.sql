
-- Corrigir políticas RLS para permitir acesso anônimo aos profiles durante checkout
-- Isso é necessário para que o cardápio digital funcione sem autenticação

-- Verificar se a política já existe e removê-la se necessário
DROP POLICY IF EXISTS "Allow anonymous access to profiles for digital menu" ON public.profiles;

-- Criar política que permite acesso anônimo de leitura aos profiles
-- Isso é necessário para o cardápio digital funcionar
CREATE POLICY "Allow anonymous access to profiles for digital menu" 
ON public.profiles 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Garantir que usuários anônimos possam ler informações básicas de entrega
DROP POLICY IF EXISTS "Anonymous users can read basic profile info" ON public.profiles;
CREATE POLICY "Anonymous users can read basic profile info" 
ON public.profiles 
FOR SELECT 
TO anon
USING (true);

-- Verificar e corrigir política para orders também
DROP POLICY IF EXISTS "Anonymous users can create orders" ON public.orders;
CREATE POLICY "Anonymous users can create orders" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);
