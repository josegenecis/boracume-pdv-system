
-- Add stripe_price_id to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Clear existing plans to ensure consistency
TRUNCATE TABLE public.subscription_plans;

-- Insert Standardized Plans
INSERT INTO public.subscription_plans (name, description, price, features, stripe_price_id) 
VALUES 
  (
    'Essencial', 
    'Para quem está começando', 
    89.00, 
    '["Cardápio Digital", "PDV Frente de Caixa", "Gestão de Pedidos", "Até 100 Produtos", "Relatórios Básicos", "1 Usuário"]'::jsonb,
    'price_H5ggYJDqQq' 
  ),
  (
    'Profissional', 
    'Para restaurantes em crescimento', 
    169.00, 
    '["Tudo do Essencial", "Produtos Ilimitados", "Gestão de Entregadores", "KDS (Tela de Cozinha)", "Controle de Estoque", "Gestão Financeira", "Até 5 Usuários", "WhatsApp Bot (Cardápio)"]'::jsonb,
    'price_H5ggYJDqQr' 
  ),
  (
    'Enterprise', 
    'Para redes e franquias', 
    229.00, 
    '["Tudo do Profissional", "Múltiplas Lojas", "API de Integração", "Suporte Prioritário", "Gerente de Contas", "Customização de Marca", "Agente de Voz IA", "Importação de Cardápio com IA"]'::jsonb,
    'price_H5ggYJDqQs' 
  );
