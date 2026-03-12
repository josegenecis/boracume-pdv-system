import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processSupportChat } from '@/services/agentService';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: 'typing' | 'done' | 'error';
};

function makeId() {
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function toHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}

function typeDelayFor(text: string) {
  const len = Math.max(20, Math.min(text.length, 900));
  return Math.min(2200, 200 + Math.floor(len * 6));
}

export default function SupportChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: 'assistant',
      content: 'Olá! Sou do suporte. Como posso te ajudar?',
      status: 'done'
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const renderTyping = async (messageId: string, fullText: string) => {
    const startDelay = typeDelayFor(fullText);
    await new Promise((r) => setTimeout(r, startDelay));
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: '', status: 'typing' } : m)));

    const chars = Array.from(fullText);
    let i = 0;
    const step = () => {
      i += Math.max(1, Math.floor(Math.random() * 4));
      const next = chars.slice(0, i).join('');
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: next } : m)));
      if (i >= chars.length) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: 'done' } : m)));
        return;
      }
      const nextDelay = 18 + Math.floor(Math.random() * 35);
      setTimeout(step, nextDelay);
    };
    step();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!user?.id) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }
    setSending(true);
    setInput('');

    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text, status: 'done' };
    const typingMsg: ChatMessage = { id: makeId(), role: 'assistant', content: 'digitando…', status: 'typing' };
    setMessages((prev) => [...prev, userMsg, typingMsg]);

    try {
      const history = toHistory([...messages, userMsg]);
      const res = await processSupportChat(text, user.id, history);
      const reply = String(res.message || 'Certo.');
      await renderTyping(typingMsg.id, reply);
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === typingMsg.id ? { ...m, content: 'Não consegui responder agora.', status: 'error' } : m))
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[360px] border rounded-lg p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : m.status === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  {m.status === 'typing' && m.role === 'assistant' && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua mensagem…" disabled={sending} />
        <Button type="submit" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

