import React from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

type TefSettings = {
  enabled: boolean
}

const storageKey = (userId?: string) => `tef_settings:${userId || 'anon'}`

export const useTefSettings = () => {
  const { user } = useAuth()
  const [settings, setSettings] = React.useState<TefSettings>({ enabled: false })
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      try {
        const { data, error } = await (supabase as any)
          .from('tef_settings')
          .select('enabled')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!error && data && typeof data.enabled === 'boolean') {
          setSettings({ enabled: data.enabled })
          localStorage.setItem(storageKey(user.id), JSON.stringify({ enabled: data.enabled }))
          return
        }
      } catch {}
      try {
        const cached = localStorage.getItem(storageKey(user.id))
        if (cached) setSettings(JSON.parse(cached))
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    load()
  }, [load])

  const save = React.useCallback(async (next: TefSettings) => {
    if (!user?.id) return
    setSettings(next)
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(next))
    } catch {}
    try {
      const { data } = await (supabase as any)
        .from('tef_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.id) {
        await (supabase as any).from('tef_settings').update({ enabled: next.enabled }).eq('id', data.id)
      } else {
        await (supabase as any).from('tef_settings').insert({ user_id: user.id, enabled: next.enabled })
      }
    } catch {}
  }, [user?.id])

  return { settings, loading, save, reload: load }
}
