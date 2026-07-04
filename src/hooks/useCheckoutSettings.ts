import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type CheckoutMode = 'express' | 'complete';

interface CheckoutSettings {
  mode: CheckoutMode;
}

const DEFAULT_SETTINGS: CheckoutSettings = {
  mode: 'complete',
};

export function useCheckoutSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CheckoutSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('checkout_settings' as any)
        .select('mode')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const mode = (data as any)?.mode === 'express' ? 'express' : 'complete';
      setSettings({ mode });
    } catch (error) {
      console.warn('Nao foi possivel carregar configuracao do checkout:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (patch: Partial<CheckoutSettings>) => {
    if (!user?.id) return false;

    const next: CheckoutSettings = {
      ...settings,
      ...patch,
      mode: patch.mode === 'express' ? 'express' : patch.mode === 'complete' ? 'complete' : settings.mode,
    };

    setSettings(next);
    const { error } = await supabase
      .from('checkout_settings' as any)
      .upsert({
        user_id: user.id,
        mode: next.mode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Erro ao salvar configuracao do checkout:', error);
      await load();
      return false;
    }

    return true;
  }, [load, settings, user?.id]);

  return {
    settings,
    loading,
    reload: load,
    save,
  };
}

