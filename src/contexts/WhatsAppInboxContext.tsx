import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type InboxSummary = {
  totalUnread: number;
  waitingConversations: number;
  urgentConversations: number;
};

type IncomingPreview = { conversationId: string; customerName: string; content: string };

const WhatsAppInboxContext = createContext<InboxSummary>({ totalUnread: 0, waitingConversations: 0, urgentConversations: 0 });

export function useWhatsAppInbox() {
  return useContext(WhatsAppInboxContext);
}

export function WhatsAppInboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState<InboxSummary>({ totalUnread: 0, waitingConversations: 0, urgentConversations: 0 });
  const [preview, setPreview] = useState<IncomingPreview | null>(null);
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) {
      setSummary({ totalUnread: 0, waitingConversations: 0, urgentConversations: 0 });
      return;
    }
    let active = true;

    const loadSummary = async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('unread_count,queue_status,last_customer_message_at')
        .eq('user_id', user.id);
      if (!active || error) return;
      const now = Date.now();
      let totalUnread = 0;
      let waitingConversations = 0;
      let urgentConversations = 0;
      for (const item of data || []) {
        const unread = Math.max(0, Number(item.unread_count || 0));
        totalUnread += unread;
        if (unread > 0 || item.queue_status === 'new') waitingConversations += 1;
        const since = item.last_customer_message_at ? now - new Date(item.last_customer_message_at).getTime() : 0;
        if (unread > 0 && since >= 5 * 60_000) urgentConversations += 1;
      }
      setSummary({ totalUnread, waitingConversations, urgentConversations });
    };

    const notifyIncoming = async (message: any) => {
      const { data: conversation } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('id,user_id,customer_name,customer_phone')
        .eq('id', message.conversation_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!conversation || !active) return;
      const customerName = conversation.customer_name || conversation.customer_phone || 'Cliente';
      setPreview({ conversationId: conversation.id, customerName, content: String(message.content || 'Nova mensagem') });
    };

    void loadSummary();
    const channel = supabase.channel(`whatsapp-inbox-global:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const message = payload.new as any;
        if (message.sender !== 'customer' || message.message_type === 'order_draft') return;
        void notifyIncoming(message).finally(loadSummary);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `user_id=eq.${user.id}` }, () => {
        void loadSummary();
      })
      .subscribe();
    const timer = window.setInterval(() => { if (!document.hidden) void loadSummary(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo(() => summary, [summary]);
  const isOrderingScreen = /\/(menu|totem|track)/.test(location.pathname);

  return (
    <WhatsAppInboxContext.Provider value={value}>
      {children}
      {preview && !isOrderingScreen ? (
        <div className="fixed bottom-5 right-5 z-[100] w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#25d366]/35 bg-white shadow-2xl">
          <div className="flex items-start gap-3 bg-[#075e54] p-4 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25d366]"><MessageCircle className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-bold">{preview.customerName}</p><p className="line-clamp-2 text-sm text-white/85">{preview.content}</p></div>
            <button type="button" aria-label="Fechar aviso" onClick={() => setPreview(null)}><X className="h-5 w-5" /></button>
          </div>
          <button type="button" className="w-full bg-[#25d366] px-4 py-3 text-sm font-bold text-[#075e54] hover:bg-[#20c45b]" onClick={() => { setPreview(null); navigate(`/whatsapp-bot?conversation=${preview.conversationId}`); }}>
            Abrir atendimento
          </button>
        </div>
      ) : null}
    </WhatsAppInboxContext.Provider>
  );
}
