import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export const usePushNotifications = () => {
  const { user } = useAuth()

  const ensureSubscribed = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
    const payload = { endpoint: sub.endpoint, keys: (sub.toJSON() as any).keys, user_id: user?.id }
    await supabase.from('push_subscriptions').upsert(payload as any, { onConflict: 'endpoint' })
    return true
  }

  return { ensureSubscribed }
}

