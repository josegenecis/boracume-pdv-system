import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const digits = (value?: string | null) => String(value || '').replace(/\D/g, '');
const phoneKeys = (value?: string | null) => {
  const normalized = digits(value);
  const local = normalized.startsWith('55') ? normalized.slice(2) : normalized;
  return Array.from(new Set([normalized, local, local.slice(-11), local.slice(-10)].filter(Boolean)));
};

export function useWhatsAppUnreadCounts(userId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('customer_phone,unread_count')
      .eq('user_id', userId);
    if (error) {
      console.warn('Não foi possível carregar mensagens não lidas:', error);
      return;
    }
    const next: Record<string, number> = {};
    for (const conversation of data || []) {
      const unread = Math.max(0, Number(conversation.unread_count || 0));
      for (const key of phoneKeys(conversation.customer_phone)) next[key] = Math.max(next[key] || 0, unread);
    }
    setCounts(next);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void load();
    const channel = supabase
      .channel(`order-whatsapp-unread-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `user_id=eq.${userId}`,
      }, () => { void load(); })
      .subscribe();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    return () => {
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const getUnread = useCallback((phone?: string | null) => {
    return phoneKeys(phone).reduce((largest, key) => Math.max(largest, counts[key] || 0), 0);
  }, [counts]);

  return { getUnread, refreshUnread: load };
}
