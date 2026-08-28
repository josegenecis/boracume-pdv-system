-- Índices parciais para as duas condições usadas pelas telas que aguardam
-- pedidos. Mantêm o índice pequeno e evitam varrer o histórico completo.
CREATE INDEX IF NOT EXISTS idx_orders_pending_acceptance_user_created
  ON public.orders (user_id, created_at DESC)
  WHERE acceptance_status IN ('pending_acceptance', 'awaiting_pix_payment');
CREATE INDEX IF NOT EXISTS idx_orders_pending_status_user_created
  ON public.orders (user_id, created_at DESC)
  WHERE status = 'pending';
