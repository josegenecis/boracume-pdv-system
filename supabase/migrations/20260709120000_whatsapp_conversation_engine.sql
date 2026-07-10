-- Conversation engine foundations for PopSystem WhatsApp AI.

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS human_handoff_timeout_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_resume_human_handoff boolean NOT NULL DEFAULT true;

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'AI',
  ADD COLUMN IF NOT EXISTS current_state text NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS last_human_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ai_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_resume_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_conversations_owner_check'
      AND conrelid = 'public.ai_conversations'::regclass
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_owner_check
      CHECK (owner IN ('AI', 'HUMAN', 'HYBRID'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_conversations_current_state_check'
      AND conrelid = 'public.ai_conversations'::regclass
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_current_state_check
      CHECK (current_state IN (
        'IDLE',
        'GREETING',
        'SHOWING_MENU',
        'SEARCHING_PRODUCT',
        'ASKING_VARIATION',
        'ADDING_TO_CART',
        'CHECKOUT',
        'WAITING_PAYMENT',
        'ORDER_CONFIRMED',
        'ORDER_PREPARING',
        'ORDER_DELIVERING',
        'FINISHED',
        'HUMAN_ATTENDING'
      ));
  END IF;
END $$;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'AI',
  ADD COLUMN IF NOT EXISTS current_state text NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS last_human_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ai_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_resume_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_owner_check'
      AND conrelid = 'public.whatsapp_conversations'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_owner_check
      CHECK (owner IN ('AI', 'HUMAN', 'HYBRID'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_current_state_check'
      AND conrelid = 'public.whatsapp_conversations'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_current_state_check
      CHECK (current_state IN (
        'IDLE',
        'GREETING',
        'SHOWING_MENU',
        'SEARCHING_PRODUCT',
        'ASKING_VARIATION',
        'ADDING_TO_CART',
        'CHECKOUT',
        'WAITING_PAYMENT',
        'ORDER_CONFIRMED',
        'ORDER_PREPARING',
        'ORDER_DELIVERING',
        'FINISHED',
        'HUMAN_ATTENDING'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.conversation_cart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  legacy_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_cart_restaurant_idx
  ON public.conversation_cart (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_cart_ai_conversation_idx
  ON public.conversation_cart (ai_conversation_id);

CREATE TABLE IF NOT EXISTS public.restaurant_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

CREATE TABLE IF NOT EXISTS public.intent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  legacy_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  customer_phone text,
  intent text NOT NULL,
  confidence numeric(5,4),
  entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intent_logs_restaurant_idx
  ON public.intent_logs (restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.handoff_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  legacy_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  customer_phone text,
  previous_owner text,
  new_owner text NOT NULL,
  reason text,
  actor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handoff_logs_restaurant_idx
  ON public.handoff_logs (restaurant_id, created_at DESC);

ALTER TABLE public.conversation_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_cart' AND policyname = 'conversation_cart_owner_all') THEN
    CREATE POLICY conversation_cart_owner_all ON public.conversation_cart
      FOR ALL USING (auth.uid() = restaurant_id) WITH CHECK (auth.uid() = restaurant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'restaurant_memory' AND policyname = 'restaurant_memory_owner_all') THEN
    CREATE POLICY restaurant_memory_owner_all ON public.restaurant_memory
      FOR ALL USING (auth.uid() = restaurant_id) WITH CHECK (auth.uid() = restaurant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'intent_logs' AND policyname = 'intent_logs_owner_all') THEN
    CREATE POLICY intent_logs_owner_all ON public.intent_logs
      FOR ALL USING (auth.uid() = restaurant_id) WITH CHECK (auth.uid() = restaurant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'handoff_logs' AND policyname = 'handoff_logs_owner_all') THEN
    CREATE POLICY handoff_logs_owner_all ON public.handoff_logs
      FOR ALL USING (auth.uid() = restaurant_id) WITH CHECK (auth.uid() = restaurant_id);
  END IF;
END $$;

