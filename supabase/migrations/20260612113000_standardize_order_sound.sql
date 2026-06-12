-- Padroniza o toque de novos pedidos para todos os restaurantes.
-- O frontend passa a usar sempre public/sounds/Toque PopSystem.mp3.

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS order_sound TEXT DEFAULT 'bell',
  ADD COLUMN IF NOT EXISTS custom_bell_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_chime_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_ding_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_notification_url TEXT;

UPDATE public.notification_settings
SET
  order_sound = 'bell',
  custom_bell_url = NULL,
  custom_chime_url = NULL,
  custom_ding_url = NULL,
  custom_notification_url = NULL,
  updated_at = NOW()
WHERE
  order_sound IS DISTINCT FROM 'bell'
  OR custom_bell_url IS NOT NULL
  OR custom_chime_url IS NOT NULL
  OR custom_ding_url IS NOT NULL
  OR custom_notification_url IS NOT NULL;

INSERT INTO public.notification_settings (
  user_id,
  email_notifications,
  push_notifications,
  sms_notifications,
  sound_enabled,
  order_sound,
  volume,
  new_orders,
  order_updates,
  low_stock,
  daily_reports,
  custom_bell_url,
  custom_chime_url,
  custom_ding_url,
  custom_notification_url
)
SELECT
  p.id,
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  'bell',
  '80',
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  NULL,
  NULL,
  NULL,
  NULL
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_settings ns
  WHERE ns.user_id = p.id
);
