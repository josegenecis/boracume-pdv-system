
-- Adicionar colunas aos produtos para controlar onde podem ser vendidos e se vão para o KDS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS available_delivery BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS available_pdv BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_to_kds BOOLEAN DEFAULT false;

-- Criar tabela para planos de assinatura se ainda não existir
INSERT INTO public.subscription_plans (id, name, description, price, features) 
VALUES 
  (1, 'Basic', 'Plano básico com funcionalidades essenciais', 29.90, '["Cardápio digital", "PDV básico", "Recebimento de pedidos", "Gestão de produtos", "Relatórios básicos"]'::jsonb),
  (2, 'Pro', 'Plano profissional com recursos avançados', 79.90, '["Tudo do Basic", "Gestão de entregadores", "Sistema KDS", "Relatórios avançados", "Integração com balanças", "Marketing e promoções", "Suporte prioritário"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features;

-- Atualizar orders para incluir informações de entrega mais detalhadas
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP WITH TIME ZONE;

-- Garantir que as delivery_zones tenham todas as informações necessárias
ALTER TABLE public.delivery_zones 
ADD COLUMN IF NOT EXISTS postal_codes TEXT[], 
ADD COLUMN IF NOT EXISTS coverage_area JSONB;
