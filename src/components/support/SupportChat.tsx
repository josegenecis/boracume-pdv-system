import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import { useSupportChat } from '@/contexts/SupportChatContext';

export default function SupportChat() {
  const { messages, sending, sendMessage, clearChat } = useSupportChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

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
          void sendMessage(input);
          setInput('');
        }}
        className="flex gap-2"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua mensagem..." disabled={sending} />
        <Button type="submit" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" onClick={clearChat} disabled={sending}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

