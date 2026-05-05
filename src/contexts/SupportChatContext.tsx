import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { processSupportChat, type SupportChatHistoryMessage } from '@/services/agentService';

export type SupportChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'typing' | 'done' | 'error';
};

type SupportChatContextValue = {
  messages: SupportChatMessage[];
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

function makeId() {
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function toHistory(messages: SupportChatMessage[]): SupportChatHistoryMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}

function typeDelayFor(text: string) {
  const len = Math.max(20, Math.min(text.length, 900));
  return Math.min(2200, 200 + Math.floor(len * 6));
}

export function SupportChatProvider(props: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportChatMessage[]>([
    { id: makeId(), role: 'assistant', content: 'Olá! Sou do suporte. Como posso te ajudar?', status: 'done' }
  ]);
  const [sending, setSending] = useState(false);
  const typingTimersRef = useRef<number[]>([]);

  const storageKey = useMemo(() => (user?.id ? `support_chat_${user.id}` : ''), [user?.id]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  const clearChat = () => {
    typingTimersRef.current.forEach((t) => window.clearTimeout(t));
    typingTimersRef.current = [];
    setMessages([{ id: makeId(), role: 'assistant', content: 'Olá! Sou do suporte. Como posso te ajudar?', status: 'done' }]);
    setSending(false);
  };

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
      const t = window.setTimeout(step, nextDelay);
      typingTimersRef.current.push(t);
    };
    step();
  };

  const sendMessage = async (text: string) => {
    const content = String(text || '').trim();
    if (!content || sending) return;
    if (!user?.id) return;

    setSending(true);

    const userMsg: SupportChatMessage = { id: makeId(), role: 'user', content, status: 'done' };
    const typingMsg: SupportChatMessage = { id: makeId(), role: 'assistant', content: 'digitando...', status: 'typing' };
    setMessages((prev) => [...prev, userMsg, typingMsg]);

    try {
      const history = toHistory([...messages, userMsg]);
      const res = await processSupportChat(content, user.id, history);
      const reply = String(res.message || 'Certo.');
      await renderTyping(typingMsg.id, reply);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === typingMsg.id ? { ...m, content: 'Não consegui responder agora.', status: 'error' } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const value: SupportChatContextValue = {
    messages,
    sending,
    sendMessage,
    clearChat
  };

  return <SupportChatContext.Provider value={value}>{props.children}</SupportChatContext.Provider>;
}

export function useSupportChat() {
  const ctx = useContext(SupportChatContext);
  if (!ctx) throw new Error('SupportChatProvider ausente');
  return ctx;
}

