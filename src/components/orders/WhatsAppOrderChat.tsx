import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCheck, Loader2, Send, UserRound } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type ChatOrder = { order_number?: string; customer_name?: string; customer_phone?: string };
type ChatMessage = { id: string; content: string; sender: string; sent_at: string; delivered?: boolean | null };

const onlyDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');
const phoneCandidates = (value?: string | null) => {
  const normalized = onlyDigits(value);
  const withCountry = normalized.startsWith('55') ? normalized : `55${normalized}`;
  const local = withCountry.slice(2);
  return Array.from(new Set([withCountry, local, local.slice(-11), local.slice(-10)].filter(Boolean)));
};

function WhatsAppLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="currentColor">
      <path d="M16.02 3A12.9 12.9 0 0 0 5.1 22.77L3.36 29l6.38-1.67A12.94 12.94 0 1 0 16.02 3Zm0 23.68a10.7 10.7 0 0 1-5.46-1.5l-.39-.23-3.78.99 1.01-3.68-.25-.4a10.72 10.72 0 1 1 8.87 4.82Zm5.88-8.03c-.32-.16-1.91-.94-2.21-1.05-.3-.11-.51-.16-.73.16-.21.33-.83 1.05-1.02 1.27-.19.22-.38.24-.7.08-.33-.16-1.37-.5-2.61-1.61a9.8 9.8 0 0 1-1.81-2.25c-.19-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.55-.73-.56h-.62c-.22 0-.57.08-.87.4-.3.33-1.13 1.11-1.13 2.7s1.16 3.13 1.32 3.35c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.91-.79 2.18-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z" />
    </svg>
  );
}

export default function WhatsAppOrderChat({ order, open, onOpenChange, onRead }: {
  order: ChatOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRead?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onReadRef = useRef(onRead);

  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (!open || !user?.id || !order?.customer_phone) return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const candidates = phoneCandidates(order.customer_phone);
        let { data: conversations, error } = await (supabase as any)
          .from('whatsapp_conversations')
          .select('id')
          .eq('user_id', user.id)
          .in('customer_phone', candidates)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        let id = conversations?.[0]?.id as string | undefined;
        if (!id) {
          const created = await (supabase as any).from('whatsapp_conversations').insert({
            user_id: user.id,
            customer_phone: candidates[0],
            customer_name: order.customer_name || 'Cliente',
            status: 'active',
          }).select('id').single();
          if (created.error) throw created.error;
          id = created.data.id;
        }
        if (!active || !id) return;
        setConversationId(id);
        const result = await (supabase as any)
          .from('whatsapp_messages')
          .select('id,content,sender,sent_at,delivered,message_type')
          .eq('conversation_id', id)
          .neq('message_type', 'order_draft')
          .order('sent_at', { ascending: true })
          .limit(200);
        if (result.error) throw result.error;
        if (active) setMessages(result.data || []);
        await (supabase as any).from('whatsapp_conversations').update({
          unread_count: 0,
          last_read_at: new Date().toISOString(),
        }).eq('id', id).eq('user_id', user.id);
        onReadRef.current?.();

        channel = supabase.channel(`order-chat-${id}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${id}`,
          }, (payload) => {
            const message = payload.new as ChatMessage & { message_type?: string };
            if (message.message_type === 'order_draft') return;
            setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
            if (message.sender === 'customer') {
              void (supabase as any).from('whatsapp_conversations').update({ unread_count: 0, last_read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
              onReadRef.current?.();
            }
          }).subscribe();
      } catch (error: any) {
        toast({ title: 'WhatsApp indisponível', description: error?.message || 'Não foi possível abrir a conversa.', variant: 'destructive' });
      } finally {
        if (active) setLoading(false);
      }
    };
    void start();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
      setConversationId(null);
    };
  }, [open, order?.customer_phone, order?.customer_name, user?.id]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !conversationId || !order?.customer_phone || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { number: order.customer_phone, message: content },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any)?.message || 'A Evolution não confirmou o envio.');
      const inserted = await (supabase as any).from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content,
        sender: 'agent',
        message_type: 'text',
        delivered: true,
      }).select('id,content,sender,sent_at,delivered').single();
      if (inserted.error) throw inserted.error;
      setMessages((current) => current.some((item) => item.id === inserted.data.id) ? current : [...current, inserted.data]);
      setDraft('');
    } catch (error: any) {
      toast({ title: 'Mensagem não enviada', description: error?.message || 'Verifique a conexão do WhatsApp.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 border-0 bg-[#efeae2] p-0 sm:max-w-[460px] [&>button]:right-3 [&>button]:top-4 [&>button]:z-20 [&>button]:text-white">
        <header className="flex min-h-[72px] items-center gap-3 bg-[#075e54] px-4 pr-12 text-white shadow-sm">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-semibold text-white">{order?.customer_name || 'Cliente'}</SheetTitle>
            <SheetDescription className="truncate text-xs text-white/75">
              {order?.customer_phone || 'Sem telefone'} · Pedido {order?.order_number || ''}
            </SheetDescription>
          </div>
          <WhatsAppLogo className="h-7 w-7 text-[#25d366]" />
        </header>

        <div className="border-b border-black/5 bg-[#128c7e] px-4 py-2 text-center text-[11px] text-white/90">
          Atendimento humano ativo · o Pop Agente pausa ao enviar
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.7)_0_1px,transparent_1.5px)] bg-[length:18px_18px] px-3 py-4 sm:px-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[#54656f]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando conversa...</div>
          ) : messages.length === 0 ? (
            <div className="mx-auto mt-8 max-w-[300px] rounded-lg bg-[#fff5c4] px-4 py-3 text-center text-xs text-[#54656f] shadow-sm">
              Esta conversa ainda não possui mensagens. Envie a primeira mensagem ao cliente.
            </div>
          ) : (
            <div className="space-y-1.5">
              {messages.map((message) => {
                const outgoing = message.sender !== 'customer';
                return (
                  <div key={message.id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[86%] rounded-lg px-2.5 py-1.5 text-[13px] text-[#111b21] shadow-sm ${outgoing ? 'rounded-tr-sm bg-[#d9fdd3]' : 'rounded-tl-sm bg-white'}`}>
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                        {new Date(message.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {outgoing ? <CheckCheck className="h-3.5 w-3.5 text-[#8696a0]" /> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        <form onSubmit={sendMessage} className="flex items-end gap-2 bg-[#f0f2f5] p-2.5">
          <label className="sr-only" htmlFor="order-whatsapp-message">Mensagem</label>
          <textarea
            id="order-whatsapp-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Mensagem"
            rows={1}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-[#667781]"
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensagem" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00a884] text-white transition hover:bg-[#008f72] disabled:opacity-50">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function WhatsAppOrderButtonContent({ unread, compact = false }: { unread: number; compact?: boolean }) {
  return (
    <>
      <span className="relative mr-1.5 inline-flex">
        <WhatsAppLogo className="h-4 w-4" />
        {unread > 0 ? <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread > 99 ? '99+' : unread}</span> : null}
      </span>
      {compact ? 'Whats' : 'WhatsApp'}
    </>
  );
}
