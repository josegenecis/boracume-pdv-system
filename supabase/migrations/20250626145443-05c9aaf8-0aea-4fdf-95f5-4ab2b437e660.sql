
-- Primeiro, remover todas as políticas existentes para garantir limpeza
DROP POLICY IF EXISTS "Public profiles viewable for menu" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow customer creation for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Allow customer read for digital menu" ON public.customers;
DROP POLICY IF EXISTS "Allow order creation for digital menu" ON public.orders;
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Allow kitchen order creation" ON public.kitchen_orders;
DROP POLICY IF EXISTS "Users can view their kitchen orders" ON public.kitchen_orders;

-- Agora criar as políticas necessárias
-- Política para permitir que usuários anônimos leiam perfis básicos (necessário para cardápio digital)
CREATE POLICY "Public profiles viewable for menu" 
ON public.profiles 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Política para usuários autenticados gerenciarem seus próprios perfis
CREATE POLICY "Users can manage own profile" 
ON public.profiles 
FOR ALL 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Políticas para customers (necessário para pedidos do cardápio digital)
CREATE POLICY "Allow customer creation for digital menu" 
ON public.customers 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Allow customer read for digital menu" 
ON public.customers 
FOR SELECT 
TO anon, authenticated
USING (user_id IS NOT NULL);

-- Políticas para orders (pedidos do cardápio digital)
CREATE POLICY "Allow order creation for digital menu" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Users can view their orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para kitchen_orders (necessário para KDS)
CREATE POLICY "Allow kitchen order creation" 
ON public.kitchen_orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (user_id IS NOT NULL);

CREATE POLICY "Users can view their kitchen orders" 
ON public.kitchen_orders 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
