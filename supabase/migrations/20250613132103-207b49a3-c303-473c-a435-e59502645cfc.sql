-- Atualizar perfis que não têm restaurant_name para ter um nome padrão
UPDATE public.profiles 
SET restaurant_name = 'Meu Restaurante', 
    updated_at = now()
WHERE restaurant_name IS NULL OR restaurant_name = '';