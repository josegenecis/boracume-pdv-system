import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Bot, CheckCircle2, ImageIcon, Loader2, Paperclip, Send, Sparkles, StopCircle, User, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cancelAgentBackgroundJob, processAgentCommand, type SupportChatHistoryMessage } from '@/services/agentService';
import { supabase } from '@/integrations/supabase/client';
import { getLocalOperatorSession } from '@/services/operatorAuth';

interface ConsoleMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  status?: 'processing' | 'success' | 'error';
  metadata?: any;
  imageUrl?: string;
}

interface AgentConsoleProps {
  className?: string;
  compact?: boolean;
}

const quickCommands = [
  'Me explique onde encontro uma função do sistema',
  'Gere imagens para produtos sem imagem',
  'Crie uma promoção para hoje com os produtos mais vendidos',
  'Liste produtos sem imagem e sem descrição',
  'Lance esta nota fiscal como despesa e organize por categoria',
];

const thinkingMessages = [
  'Pensando e consultando o sistema...',
  'Lendo os dados reais do restaurante...',
  'Executando com segurança...',
  'Conferindo o resultado...'
];

const activeJobStatuses = ['queued', 'running', 'cancel_requested'];
const finishedJobStatuses = ['done', 'failed', 'partial', 'paused_timeout', 'cancelled'];

const isMissingProductImagesCommand = (command: string) => {
  const text = String(command || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    /produtos?.{0,40}sem imagem/.test(text) &&
    /(gerar|gere|criar|crie|fazer|preencher|colocar|adicionar).{0,50}imagens?/.test(text)
  ) || /imagens?.{0,50}produtos?.{0,50}sem imagem/.test(text);
};

const formatJobProgressMessage = (metadata: any) => {
  const status = String(metadata?.status || 'running');
  const updated = Number(metadata?.updated || 0);
  const processed = Number(metadata?.processed || 0);
  const failures = Number(metadata?.failures || 0);
  const remaining = metadata?.remaining_without_image;
  const remainingText = typeof remaining === 'number' ? `- Ainda sem imagem: ${remaining}` : '';

  if (status === 'done') {
    return [
      'Concluí a geração das imagens em segundo plano.',
      '',
      `- Atualizadas: ${updated}`,
      `- Processadas: ${processed}`,
      failures ? `- Falhas: ${failures}` : '',
      remainingText ? `- Ainda sem imagem: ${remaining}` : ''
    ].filter(Boolean).join('\n');
  }

  if (status === 'failed') {
    return [
      'O job de geração de imagens encontrou um problema.',
      '',
      `- Atualizadas antes da falha: ${updated}`,
      `- Processadas: ${processed}`,
      failures ? `- Falhas: ${failures}` : '',
      metadata?.error ? `- Erro: ${metadata.error}` : ''
    ].filter(Boolean).join('\n');
  }

  if (status === 'cancel_requested') {
    return [
      'Estou parando a geração com segurança.',
      '',
      `- Atualizadas até agora: ${updated}`,
      `- Processadas: ${processed}`,
      failures ? `- Falhas: ${failures}` : '',
      'Vou finalizar o item atual e encerrar o job.'
    ].filter(Boolean).join('\n');
  }

  if (status === 'cancelled') {
    return [
      'Geração de imagens cancelada.',
      '',
      `- Atualizadas antes de parar: ${updated}`,
      `- Processadas: ${processed}`,
      failures ? `- Falhas: ${failures}` : '',
      remainingText
    ].filter(Boolean).join('\n');
  }

  if (status === 'partial' || status === 'paused_timeout') {
    return [
      'O job de imagens terminou parcialmente.',
      '',
      `- Atualizadas: ${updated}`,
      `- Processadas: ${processed}`,
      failures ? `- Falhas: ${failures}` : '',
      remainingText,
      'Alguns itens podem ter falhado por limite da API, timeout ou produto muito difícil de representar.'
    ].filter(Boolean).join('\n');
  }

  return [
    'Estou gerando as imagens em segundo plano.',
    '',
    `- Atualizadas até agora: ${updated}`,
    `- Processadas: ${processed}`,
    failures ? `- Falhas: ${failures}` : '',
    remainingText,
    'Pode sair desta página; quando voltar eu continuo mostrando o andamento.'
  ].filter(Boolean).join('\n');
};

export function AgentConsole({ className, compact = false }: AgentConsoleProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recoveredJobsForUserRef = useRef<string>('');
  const { user } = useAuth();
  const { toast } = useToast();
  const storageKey = user?.id ? `pop-ai-agent-console:${user.id}` : '';

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!storageKey) {
      setStorageHydrated(true);
      return;
    }
    setStorageHydrated(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setMessages([]);
        return;
      }
      setMessages(parsed.map((message: any) => ({
        ...message,
        timestamp: message?.timestamp ? new Date(message.timestamp) : new Date()
      })));
    } catch {
      setMessages([]);
    } finally {
      setStorageHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !storageHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-80)));
    } catch {}
  }, [messages, storageKey, storageHydrated]);

  useEffect(() => {
    if (!user?.id || !storageHydrated || messages.length > 0 || recoveredJobsForUserRef.current === user.id) return;
    recoveredJobsForUserRef.current = user.id;

    const recoverRunningJobs = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('agent_activity_logs')
        .select('id, description, metadata, created_at')
        .eq('user_id', user.id)
        .eq('action_type', 'ai_image_job')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data?.length) return;

      const activeRows = data.filter((row: any) => {
        const status = String(row?.metadata?.status || 'queued');
        return activeJobStatuses.includes(status);
      });

      if (!activeRows.length) return;

      setMessages((prev) => {
        if (prev.length > 0) return prev;
        return activeRows.reverse().map((row: any) => ({
          id: `job-${row.id}`,
          type: 'agent',
          content: formatJobProgressMessage(row.metadata || {}),
          timestamp: row.created_at ? new Date(row.created_at) : new Date(),
          status: 'processing',
          metadata: {
            background_job: {
              id: row.id,
              type: 'missing_product_images',
              status: row?.metadata?.status || 'queued',
              log: row
            }
          }
        }));
      });
    };

    void recoverRunningJobs();
  }, [messages.length, storageHydrated, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const pollJobs = async () => {
      const activeJobs = messages
        .filter((message) => message.type === 'agent' && message.metadata?.background_job?.id && message.status === 'processing')
        .map((message) => ({ messageId: message.id, jobId: String(message.metadata.background_job.id) }));

      if (activeJobs.length === 0) return;

      const { data, error } = await supabase
        .from('agent_activity_logs')
        .select('id, description, metadata, created_at')
        .eq('user_id', user.id)
        .in('id', activeJobs.map((job) => job.jobId));
      if (error) return;

      const rowsById = new Map((data || []).map((row: any) => [String(row.id), row]));
      setMessages((prev) => prev.map((message) => {
        const job = activeJobs.find((item) => item.messageId === message.id);
        if (!job) return message;
        const row: any = rowsById.get(job.jobId);
        if (!row) return message;
        const jobMetadata = row.metadata || {};
        const status = String(jobMetadata.status || 'running');
        const finished = finishedJobStatuses.includes(status);
        return {
          ...message,
          content: formatJobProgressMessage(jobMetadata),
          status: finished ? (status === 'failed' ? 'error' : 'success') : 'processing',
          metadata: {
            ...message.metadata,
            background_job: {
              ...message.metadata?.background_job,
              status,
              log: row
            }
          }
        };
      }));
    };

    void pollJobs();
    const interval = window.setInterval(pollJobs, 5000);
    return () => window.clearInterval(interval);
  }, [messages, user?.id]);

  const addMessage = (message: Omit<ConsoleMessage, 'id' | 'timestamp'>) => {
    const newMessage: ConsoleMessage = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  };

  const buildHistory = (): SupportChatHistoryMessage[] =>
    messages
      .filter((message) => message.status !== 'processing')
      .slice(-30)
      .map((message) => ({
        role: message.type === 'user' ? 'user' : 'assistant',
        content: message.content
      }));

  const getActiveBackgroundJobMessage = () =>
    messages.find((message) => {
      const status = String(message.metadata?.background_job?.status || '');
      return message.type === 'agent'
        && message.metadata?.background_job?.id
        && message.status === 'processing'
        && (!status || activeJobStatuses.includes(status));
    });

  const handleStopJob = async (message: ConsoleMessage) => {
    const jobId = String(message.metadata?.background_job?.id || '');
    if (!user?.id || !jobId) return;

    setMessages((prev) => prev.map((item) => (
      item.id === message.id
        ? {
            ...item,
            content: formatJobProgressMessage({
              ...(item.metadata?.background_job?.log?.metadata || {}),
              status: 'cancel_requested'
            }),
            status: 'processing',
            metadata: {
              ...item.metadata,
              background_job: {
                ...item.metadata?.background_job,
                status: 'cancel_requested'
              }
            }
          }
        : item
    )));

    const result = await cancelAgentBackgroundJob(user.id, jobId);
    toast({
      title: result.success ? 'Parando job' : 'Não consegui parar',
      description: result.message,
      variant: result.success ? 'default' : 'destructive'
    });
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione uma imagem.',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => setSelectedImage(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitCommand = async (command: string) => {
    const text = command.trim();
    if ((!text && !selectedImage) || isProcessing) return;

    if (!user?.id) {
      toast({
        title: 'Faça login',
        description: 'Entre no sistema para usar o Assistente Pop.',
        variant: 'destructive'
      });
      return;
    }

    const activeBackgroundJob = getActiveBackgroundJobMessage();
    if (activeBackgroundJob && isMissingProductImagesCommand(text)) {
      addMessage({
        type: 'agent',
        content: 'Já existe uma geração de imagens em andamento. Vou acompanhar o job atual em vez de executar tudo de novo.',
        status: 'success',
        metadata: activeBackgroundJob.metadata
      });
      toast({
        title: 'Job já em andamento',
        description: 'Use o botão Parar se quiser interromper antes de iniciar outro.'
      });
      return;
    }

    const history = buildHistory();
    const uploadedImage = selectedImage;
    addMessage({
      type: 'user',
      content: text || 'Analise esta imagem.',
      status: 'success',
      imageUrl: uploadedImage || undefined
    });

    setInput('');
    setSelectedImage(null);
    setIsProcessing(true);

    const processingMessage = addMessage({
      type: 'agent',
      content: thinkingMessages[0],
      status: 'processing'
    });

    let messageIndex = 0;
    const interval = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % thinkingMessages.length;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingMessage.id && message.status === 'processing'
            ? { ...message, content: thinkingMessages[messageIndex] }
            : message
        )
      );
    }, 1800);

    try {
      const operator = getLocalOperatorSession();
      const result = await processAgentCommand(
        text,
        user.id,
        uploadedImage || undefined,
        history,
        operator?.id,
      );
      window.clearInterval(interval);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingMessage.id
            ? {
                ...message,
                content: result.message,
                status: result.metadata?.background_job ? 'processing' : result.success ? 'success' : 'error',
                metadata: result.metadata
              }
            : message
        )
      );

      toast({
        title: result.success ? 'Assistente Pop executou' : 'Assistente Pop encontrou um problema',
        description: result.metadata?.background_job ? 'O job continuará no servidor mesmo se você sair da página.' : result.message,
        variant: result.success ? 'default' : 'destructive'
      });
    } catch (error) {
      window.clearInterval(interval);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingMessage.id
            ? { ...message, content: 'Não consegui concluir agora. Tente novamente em instantes.', status: 'error' }
            : message
        )
      );
      toast({
        title: 'Erro no Assistente Pop',
        description: 'Não foi possível processar o comando.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitCommand(input);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <Card className={`flex min-h-0 flex-col overflow-hidden border-0 bg-[#f7f8f3] shadow-xl ${className || ''}`}>
      <div
        className={`shrink-0 border-b bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#ff5b05] text-white ${
          compact ? 'p-4' : 'p-5'
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-lime-200">
              <Sparkles className="h-3.5 w-3.5" />
              Assistente Pop
            </div>
            <div>
              <h2 className={`${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} font-black leading-tight`}>
                Sua ajuda inteligente no PopSystem
              </h2>
              <p className="max-w-3xl text-sm text-white/80 md:text-base">
                Tire dúvidas ou peça uma alteração. O assistente consulta os dados reais e respeita as permissões do operador.
              </p>
            </div>
          </div>
          <div className={`${compact ? 'hidden xl:grid' : 'grid'} grid-cols-2 gap-2 text-xs md:grid-cols-4`}>
            {['Suporte', 'Cardápio', 'Financeiro', 'Operação'].map((label) => (
              <Badge key={label} className="justify-center border-white/20 bg-white/10 px-3 py-2 text-white hover:bg-white/15">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className={`${compact ? 'min-h-0 flex-1' : 'min-h-[620px]'} grid grid-rows-[minmax(0,1fr)_auto]`}>
        <ScrollArea
          ref={scrollRef}
          className={compact ? 'h-full min-h-0 px-4 py-4 md:px-6' : 'h-[520px] px-4 py-5 md:h-[600px] md:px-6'}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-4xl flex-col justify-center gap-6 py-10">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-white">
                  <Bot className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-black text-emerald-950">Como posso facilitar seu trabalho?</h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Pergunte como usar o sistema ou diga o resultado que deseja. Quando a ação estiver dentro da sua permissão, eu também posso executá-la.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {quickCommands.map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => submitCommand(command)}
                    className="rounded-2xl border bg-white p-4 text-left text-sm font-semibold text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
                    disabled={isProcessing}
                  >
                    <Wand2 className="mb-3 h-5 w-5 text-orange-600" />
                    {command}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-5xl flex-col gap-5">
              {messages.map((message) => {
                const isUser = message.type === 'user';
                return (
                  <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-white shadow-sm">
                        {message.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                      </div>
                    )}

                    <div className={`max-w-[88%] md:max-w-[72%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div
                        className={`rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm md:text-[15px] ${
                          isUser
                            ? 'rounded-br-md bg-emerald-950 text-white'
                            : message.status === 'error'
                              ? 'rounded-bl-md bg-red-50 text-red-800 ring-1 ring-red-100'
                              : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-100'
                        }`}
                      >
                        {message.imageUrl && (
                          <img src={message.imageUrl} alt="Imagem enviada" className="mb-3 max-h-56 rounded-2xl border object-contain" />
                        )}
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        {message.status === 'processing' && !isUser && message.metadata?.background_job && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              trabalhando em segundo plano
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50"
                              onClick={() => handleStopJob(message)}
                              disabled={String(message.metadata?.background_job?.status || '') === 'cancel_requested'}
                            >
                              <StopCircle className="mr-1 h-3.5 w-3.5" />
                              {String(message.metadata?.background_job?.status || '') === 'cancel_requested' ? 'Parando' : 'Parar'}
                            </Button>
                          </div>
                        )}
                        {message.status === 'success' && !isUser && (
                          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            concluído
                          </div>
                        )}
                      </div>
                      <span className="px-2 text-xs text-slate-500">{formatTime(message.timestamp)}</span>
                    </div>

                    {isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-950 shadow-sm ring-1 ring-slate-200">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="border-t bg-white/90 p-4 backdrop-blur md:p-5">
          <div className="mx-auto max-w-5xl space-y-3">
            {selectedImage && (
              <div className="relative inline-flex rounded-2xl border bg-white p-2 shadow-sm">
                <img src={selectedImage} alt="Imagem selecionada" className="h-20 w-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow"
                  aria-label="Remover imagem"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-3xl border bg-white p-2 shadow-lg shadow-emerald-950/5 focus-within:border-orange-300">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl text-slate-600"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                title="Anexar imagem"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitCommand(input);
                  }
                }}
                placeholder="Pergunte ou peça uma ação ao Assistente Pop..."
                disabled={isProcessing}
                className="max-h-40 min-h-[48px] flex-1 resize-none border-0 bg-transparent px-1 py-3 text-base shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                disabled={isProcessing || (!input.trim() && !selectedImage)}
                className="h-11 rounded-2xl bg-orange-600 px-5 font-bold hover:bg-orange-700"
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <ImageIcon className="h-4 w-4" />
              Agora a geração por IA usa OpenAI e salva a imagem direto no produto.
            </div>
          </div>
        </form>
      </div>
    </Card>
  );
}
