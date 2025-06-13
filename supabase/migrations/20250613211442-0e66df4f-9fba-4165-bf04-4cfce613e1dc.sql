-- Criar configurações padrão de notificação (sem conflict handling)
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
  daily_reports
)
SELECT 
  p.id as user_id,
  true as email_notifications,
  true as push_notifications,
  false as sms_notifications,
  true as sound_enabled,
  'bell' as order_sound,
  '80' as volume,
  true as new_orders,
  true as order_updates,
  true as low_stock,
  false as daily_reports
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_settings ns 
  WHERE ns.user_id = p.id
);