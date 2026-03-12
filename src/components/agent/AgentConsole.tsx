import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processAgentCommand } from '@/services/agentService';

interface ConsoleMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  status?: 'processing' | 'success' | 'error' | 'warning';
  metadata?: any;
}

interface AgentConsoleProps {
  className?: string;
}

export function AgentConsole({ className }: AgentConsoleProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedCommands] = useState([
    'Desativar carne de sol de todos os produtos',
    'Lançar despesa de R$ 150,00 para alimentação',
    'Criar produto Pizza Calabresa com tamanhos P/M/G e adicionais',
    'Gerar imagens para produtos sem imagem',
    'Mostrar ingredientes ativos',
    'Registrar nota fiscal como despesa',
    'Desativar queijo coalho'
  ]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Focus input on component mount
    inputRef.current?.focus();
  }, []);

  const addMessage = (message: Omit<ConsoleMessage, 'id' | 'timestamp'>) => {
    const newMessage: ConsoleMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) return;

    // Add user message
    addMessage({
      type: 'user',
      content: input,
      status: 'success'
    });

    const userInput = input;
    setInput('');
    setIsProcessing(true);

    // Add processing message
    const processingMessage = addMessage({
      type: 'agent',
      content: 'Conectando ao cérebro...',
      status: 'processing'
    });
    
    // Animação de "pensando"
    const thinkingMessages = ['Conectando ao cérebro...', 'Analisando comando...', 'Consultando banco de dados...', 'Executando ação...'];
    let msgIndex = 0;
    const thinkingInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % thinkingMessages.length;
        setMessages(prev => prev.map(msg => 
            msg.id === processingMessage.id && msg.status === 'processing'
              ? { ...msg, content: thinkingMessages[msgIndex] }
              : msg
        ));
    }, 2000);

    try {
      // Process the command through the agent service
      const result = await processAgentCommand(userInput, user?.id || '');
      
      clearInterval(thinkingInterval);
      
      // Update processing message with result
      setMessages(prev => prev.map(msg => 
        msg.id === processingMessage.id 
          ? { ...msg, content: result.message, status: result.success ? 'success' : 'error', metadata: result.metadata }
          : msg
      ));

      if (result.success) {
        toast({
          title: 'Comando executado com sucesso',
          description: result.message,
        });
      } else {
        toast({
          title: 'Erro ao executar comando',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      clearInterval(thinkingInterval);
      
      // Update processing message with error
      setMessages(prev => prev.map(msg => 
        msg.id === processingMessage.id 
          ? { ...msg, content: 'Erro ao processar comando. Tente novamente.', status: 'error' }
          : msg
      ));

      toast({
        title: 'Erro',
        description: 'Não foi possível processar o comando.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestedCommand = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Assistente de Comandos
        </CardTitle>
        <CardDescription>
          Execute comandos em linguagem natural para controlar ingredientes e despesas
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Suggested Commands */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Comandos sugeridos:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedCommands.map((command, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => handleSuggestedCommand(command)}
              >
                {command}
              </Badge>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[300px] border rounded-lg p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Envie um comando para começar</p>
                <p className="text-xs mt-1">Ex: "Desativar carne de sol de todos os produtos"</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'agent' && (
                    <div className="flex-shrink-0">
                      <Bot className="h-6 w-6 text-blue-500" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] space-y-1 ${
                    message.type === 'user' ? 'order-1' : ''
                  }`}>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.status === 'error'
                          ? 'bg-destructive/10 text-destructive'
                          : message.status === 'warning'
                          ? 'bg-yellow-500/10 text-yellow-700'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(message.status)}
                        <span className="text-sm">{message.content}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(message.timestamp)}
                    </div>
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0 order-2">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite seu comando..."
            disabled={isProcessing}
            className="flex-1"
          />
          <Button type="submit" disabled={isProcessing || !input.trim()}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
