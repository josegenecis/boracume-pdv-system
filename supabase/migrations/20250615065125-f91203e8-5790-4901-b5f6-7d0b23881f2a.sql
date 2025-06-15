-- Adicionar coluna para controlar numeração sequencial por usuário
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS next_order_number INTEGER DEFAULT 1;

-- Atualizar a função de geração de número do pedido
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
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