-- Habilitar RLS na tabela orders se ainda não estiver
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir inserção de pedidos por usuários não autenticados (cardápio digital)
CREATE POLICY "Allow anonymous users to create orders for digital menu" 
ON public.orders 
FOR INSERT 
TO anon
WITH CHECK (
  -- Verificar se o user_id corresponde a um restaurante válido
  user_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id
  )
);

-- Habilitar RLS na tabela kitchen_orders se ainda não estiver
ALTER TABLE public.kitchen_orders ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir inserção no KDS por usuários anônimos (via trigger)
CREATE POLICY "Allow anonymous users to create kitchen orders via trigger" 
ON public.kitchen_orders 
FOR INSERT 
TO anon
WITH CHECK (
  -- Verificar se o user_id corresponde a um restaurante válido
  user_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id
  )
);