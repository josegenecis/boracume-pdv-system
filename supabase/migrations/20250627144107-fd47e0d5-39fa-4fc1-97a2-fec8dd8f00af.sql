
-- Corrigir a função generate_order_number para ser SECURITY DEFINER
-- Isso permite que a função execute com privilégios elevados
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_order_number INTEGER;
BEGIN
  -- Buscar e incrementar o próximo número do pedido para este usuário
  UPDATE public.profiles 
  SET next_order_number = next_order_number + 1
  WHERE id = NEW.user_id
  RETURNING next_order_number - 1 INTO new_order_number;
  
  -- Se não encontrou o perfil, criar um novo número
  IF new_order_number IS NULL THEN
    new_order_number := 1;
    -- Inserir ou atualizar o perfil com o primeiro número
    INSERT INTO public.profiles (id, next_order_number)
    VALUES (NEW.user_id, 2)
    ON CONFLICT (id) 
    DO UPDATE SET next_order_number = 2;
  END IF;
  
  -- Formatar o número com zeros à esquerda (001, 002, etc.)
  NEW.order_number := LPAD(new_order_number::text, 3, '0');
  
  RETURN NEW;
END;
$function$;

-- Criar política RLS para permitir que a função do sistema atualize profiles
CREATE POLICY "Allow system to update profiles for order generation" 
ON public.profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Garantir que o trigger está ativo com a função corrigida
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;

CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW 
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_order_number();
