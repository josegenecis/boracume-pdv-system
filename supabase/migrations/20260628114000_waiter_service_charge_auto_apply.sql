ALTER TABLE public.waiter_service_charge_settings
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.waiter_service_charge_settings.enabled IS
  'Permite usar a taxa de servico no app garcom. Mesmo desligada no modo automatico, pode ser opcional no fechamento.';

COMMENT ON COLUMN public.waiter_service_charge_settings.auto_apply IS
  'Quando verdadeiro, o app garcom inicia o fechamento com os 10% marcados automaticamente.';
