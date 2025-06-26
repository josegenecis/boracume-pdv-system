
-- Corrigir a função handle_new_user para ser mais robusta e evitar conflitos RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log para debugging
  RAISE LOG 'handle_new_user triggered for user_id: %', NEW.id;
  
  -- Verificar se já existe um perfil para este usuário
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE LOG 'Profile already exists for user_id: %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Criar perfil básico para novo usuário
  BEGIN
    INSERT INTO public.profiles (
      id, 
      created_at, 
      updated_at,
      restaurant_name,
      next_order_number
    )
    VALUES (
      NEW.id, 
      now(), 
      now(),
      COALESCE(NEW.raw_user_meta_data ->> 'restaurant_name', 'Novo Restaurante'),
      1
    );
    
    RAISE LOG 'Profile created successfully for user_id: %', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'Profile creation skipped due to unique violation for user_id: %', NEW.id;
    WHEN OTHERS THEN
      RAISE LOG 'Error creating profile for user_id: %, error: %', NEW.id, SQLERRM;
  END;

  -- Criar subscription trial para novo usuário
  BEGIN
    INSERT INTO public.subscriptions (
      user_id,
      status,
      trial_start,
      trial_end,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      'trialing',
      now(),
      now() + interval '7 days',
      now(),
      now()
    );
    
    RAISE LOG 'Trial subscription created successfully for user_id: %', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE LOG 'Subscription creation skipped due to unique violation for user_id: %', NEW.id;
    WHEN OTHERS THEN
      RAISE LOG 'Error creating subscription for user_id: %, error: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can create subscriptions" ON public.subscriptions;

-- Adicionar política específica para permitir inserção de perfis pelo sistema
CREATE POLICY "System can create profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id OR current_user = 'supabase_auth_admin');

-- Adicionar política específica para permitir inserção de subscriptions pelo sistema
CREATE POLICY "System can create subscriptions" 
ON public.subscriptions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id OR current_user = 'supabase_auth_admin');
