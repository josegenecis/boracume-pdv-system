
-- Criar tabela de combos
CREATE TABLE public.combos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  image_url TEXT,
  products TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas em whatsapp_settings
ALTER TABLE public.whatsapp_settings 
ADD COLUMN IF NOT EXISTS auto_responses JSONB DEFAULT '{
  "greeting": "Olá! Bem-vindo ao nosso restaurante. Como posso ajudar você hoje?",
  "menu_request": "Aqui está nosso cardápio! Você pode ver todos os produtos disponíveis.",
  "order_confirmation": "Recebemos seu pedido! Em breve entraremos em contato para confirmar os detalhes.",
  "business_hours": "Nosso horário de funcionamento é de segunda a domingo, das 10h às 22h."
}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;

-- Habilitar RLS para combos
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para combos
CREATE POLICY "Users can view their own combos" 
  ON public.combos 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own combos" 
  ON public.combos 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own combos" 
  ON public.combos 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own combos" 
  ON public.combos 
  FOR DELETE 
  USING (auth.uid() = user_id);
