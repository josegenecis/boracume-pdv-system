-- Reestruturação comercial: apenas planos Pro e Multi.
-- O plano Multi cobra o mesmo valor base do Pro e adiciona R$149/mês por loja extra.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS included_stores integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS store_limit integer,
  ADD COLUMN IF NOT EXISTS extra_store_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_note text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS store_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS additional_store_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_store_price numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

UPDATE public.subscription_plans
SET
  name = 'Essencial (legado)',
  slug = 'legacy',
  description = 'Plano antigo mantido apenas para compatibilidade interna.',
  is_public = false,
  sort_order = 99,
  checkout_note = 'Plano legado não disponível para novas assinaturas.'
WHERE id = 1;

INSERT INTO public.subscription_plans (
  id,
  name,
  slug,
  description,
  price,
  features,
  included_stores,
  store_limit,
  extra_store_price,
  is_public,
  sort_order,
  checkout_note
)
VALUES
  (
    2,
    'Pro',
    'pro',
    'Sistema completo para uma loja: PDV, cardápio digital, pedidos, mesas, estoque, financeiro, marketing, WhatsApp, fiscal, app desktop e IA.',
    159.00,
    '[
      "PDV completo e fechamento de caixa",
      "Cardápio digital com link e QR Code",
      "Pedidos online, balcão, retirada e delivery",
      "Mesas, comandas e app garçom",
      "KDS, tela de cozinha e impressão",
      "Estoque, ingredientes e ficha técnica",
      "Financeiro, caixa, despesas e relatórios",
      "WhatsApp, campanhas e envio em massa",
      "PIX, Mercado Pago e formas de pagamento",
      "Fiscal/NFC-e, app desktop e hardware",
      "IA para cardápio, marketing e produtividade",
      "1 loja incluída"
    ]'::jsonb,
    1,
    1,
    0,
    true,
    1,
    'Plano completo para uma loja.'
  ),
  (
    3,
    'Multi',
    'multi',
    'Tudo do Pro com multilojas, painel consolidado e cobrança de R$149 por loja adicional.',
    159.00,
    '[
      "Tudo do plano Pro",
      "1 loja incluída no valor base",
      "R$149/mês por loja adicional",
      "Cadastro e operação de múltiplas lojas",
      "Painel inicial consolidado e por unidade",
      "Relatórios financeiros por loja ou rede",
      "Estoque, pedidos e operação separados por loja",
      "Usuários e permissões por unidade",
      "Troca rápida entre lojas",
      "Preparado para expansão de redes"
    ]'::jsonb,
    1,
    null,
    149.00,
    true,
    2,
    'O valor base inclui 1 loja. Cada loja adicional adiciona R$149/mês.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  included_stores = EXCLUDED.included_stores,
  store_limit = EXCLUDED.store_limit,
  extra_store_price = EXCLUDED.extra_store_price,
  is_public = EXCLUDED.is_public,
  sort_order = EXCLUDED.sort_order,
  checkout_note = EXCLUDED.checkout_note;

UPDATE public.subscriptions
SET
  store_count = COALESCE(store_count, 1),
  additional_store_count = GREATEST(COALESCE(store_count, 1) - 1, 0),
  extra_store_price = CASE WHEN COALESCE(plan_id, 0) >= 3 THEN 149.00 ELSE 0 END
WHERE store_count IS NULL
   OR additional_store_count IS NULL
   OR extra_store_price IS NULL;
