import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, MessageCircle, Bot, User, Phone, Settings, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  sender: 'customer' | 'bot' | 'staff';
  sent_at: string;
  conversation_id: string;
}

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name?: string;
  status: 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

interface WhatsAppSettings {
  id: string;
  phone_number: string;
  default_message: string;
  enabled: boolean;
  auto_responses: {
    greeting: string;
    menu_request: string;
    order_confirmation: string;
    business_hours: string;
  };
  ai_enabled: boolean;
}

const EnhancedWhatsAppChatbot = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [settingsForm, setSettingsForm] = useState({
    phone_number: '',
    default_message: '',
    enabled: true,
    auto_responses: {
      greeting: 'Olá! Bem-vindo ao nosso restaurante. Como posso ajudar você hoje?',
      menu_request: 'Aqui está nosso cardápio! Você pode ver todos os produtos disponíveis em: [MENU_LINK]',
      order_confirmation: 'Recebemos seu pedido! Em breve entraremos em contato para confirmar os detalhes.',
      business_hours: 'Nosso horário de funcionamento é de segunda a domingo, das 10h às 22h.'
    },
    ai_enabled: false
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const settingsData: WhatsAppSettings = {
          id: data.id,
          phone_number: data.phone_number,
          default_message: data.default_message,
          enabled: data.enabled,
          auto_responses: data.auto_responses || settingsForm.auto_responses,
          ai_enabled: data.ai_enabled || false
        };
        
        setSettings(settingsData);
        setSettingsForm({
          phone_number: data.phone_number,
          default_message: data.default_message,
          enabled: data.enabled,
          auto_responses: data.auto_responses || settingsForm.auto_responses,
          ai_enabled: data.ai_enabled || false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const typedConversations: Conversation[] = (data || []).map(conv => ({
        id: conv.id,
        customer_phone: conv.customer_phone,
        customer_name: conv.customer_name,
        status: (conv.status === 'closed' ? 'closed' : 'active') as 'active' | 'closed',
        created_at: conv.created_at,
        updated_at: conv.updated_at
      }));
      
      setConversations(typedConversations);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      
      const typedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: ['customer', 'bot', 'staff'].includes(msg.sender) 
          ? msg.sender as 'customer' | 'bot' | 'staff' 
          : 'customer',
        sent_at: msg.sent_at,
        conversation_id: msg.conversation_id
      }));
      
      setMessages(typedMessages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const messageData = {
        conversation_id: selectedConversation.id,
        content: newMessage,
        sender: 'staff' as const,
        sent_at: new Date().toISOString(),
        delivered: true
      };

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert([messageData]);

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedConversation.id);

      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso."
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive"
      });
    }
  };

  const saveSettings = async () => {
    try {
      const settingsData = {
        user_id: user?.id,
        ...settingsForm
      };

      if (settings) {
        const { error } = await supabase
          .from('whatsapp_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_settings')
          .insert([settingsData]);

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações do WhatsApp foram atualizadas."
      });

      setShowSettings(false);
      fetchSettings();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    }
  };

  const simulateIncomingMessage = async () => {
    if (!selectedConversation) return;

    const sampleMessages = [
      "Olá! Gostaria de fazer um pedido.",
      "Vocês fazem entrega?",
      "Qual o cardápio de hoje?",
      "Quanto tempo demora a entrega?",
      "Aceitam cartão?"
    ];

    const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

    try {
      const messageData = {
        conversation_id: selectedConversation.id,
        content: randomMessage,
        sender: 'customer' as const,
        sent_at: new Date().toISOString(),
        delivered: true
      };

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert([messageData]);

      if (error) throw error;

      fetchMessages(selectedConversation.id);

      // Simulate auto-response if AI is enabled
      if (settingsForm.ai_enabled) {
        setTimeout(() => {
          const autoResponse = getAutoResponse(randomMessage);
          if (autoResponse) {
            simulateAutoResponse(autoResponse);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao simular mensagem:', error);
    }
  };

  const simulateAutoResponse = async (response: string) => {
    if (!selectedConversation) return;

    try {
      const messageData = {
        conversation_id: selectedConversation.id,
        content: response,
        sender: 'bot' as const,
        sent_at: new Date().toISOString(),
        delivered: true
      };

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert([messageData]);

      if (error) throw error;

      fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('Erro ao enviar resposta automática:', error);
    }
  };

  const getAutoResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('cardápio') || lowerMessage.includes('menu')) {
      return settingsForm.auto_responses.menu_request;
    } else if (lowerMessage.includes('horário') || lowerMessage.includes('funcionamento')) {
      return settingsForm.auto_responses.business_hours;
    } else if (lowerMessage.includes('olá') || lowerMessage.includes('oi')) {
      return settingsForm.auto_responses.greeting;
    }
    
    return null;
  };

  const createSampleConversation = async () => {
    try {
      const conversationData = {
        user_id: user?.id,
        customer_phone: '+55119' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
        customer_name: 'Cliente Teste',
        status: 'active' as const
      };

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .insert([conversationData])
        .select()
        .single();

      if (error) throw error;

      fetchConversations();
      
      const newConversation: Conversation = {
        id: data.id,
        customer_phone: data.customer_phone,
        customer_name: data.customer_name,
        status: data.status as 'active' | 'closed',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      
      setSelectedConversation(newConversation);

      toast({
        title: "Conversa criada",
        description: "Conversa de teste criada com sucesso."
      });
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a conversa.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle size={24} className="text-green-600" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp Business</h1>
              <p className="text-sm text-gray-600">
                Central de Atendimento com IA
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <Settings size={16} className="mr-2" />
              Configurações
            </Button>
            <Button onClick={createSampleConversation}>
              <MessageCircle size={16} className="mr-2" />
              Nova Conversa (Teste)
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Conversations List */}
        <div className="w-80 border-r bg-gray-50">
          <div className="p-4 border-b">
            <h3 className="font-medium">Conversas Ativas</h3>
          </div>
          <div className="overflow-y-auto">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {conversation.customer_name || 'Cliente'}
                  </span>
                  <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                    {conversation.status === 'active' ? 'Ativo' : 'Fechado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} />
                  {conversation.customer_phone}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(conversation.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhuma conversa ativa</p>
                <Button 
                  onClick={createSampleConversation}
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                >
                  Criar Teste
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {selectedConversation.customer_name || 'Cliente'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedConversation.customer_phone}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={simulateIncomingMessage}
                    >
                      <Zap size={14} className="mr-1" />
                      Simular Mensagem
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'staff' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'staff'
                          ? 'bg-blue-500 text-white'
                          : message.sender === 'bot'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.sender === 'bot' && <Bot size={14} />}
                        {message.sender === 'customer' && <User size={14} />}
                        <span className="text-xs opacity-75">
                          {formatTime(message.sent_at)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage}>
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle size={64} className="mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Configurações do WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Número do WhatsApp</Label>
                  <Input
                    id="phone"
                    value={settingsForm.phone_number}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      phone_number: e.target.value
                    })}
                    placeholder="+5511999999999"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settingsForm.enabled}
                    onCheckedChange={(checked) => setSettingsForm({
                      ...settingsForm,
                      enabled: checked
                    })}
                  />
                  <Label>WhatsApp Ativo</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="default_message">Mensagem Padrão</Label>
                <Textarea
                  id="default_message"
                  value={settingsForm.default_message}
                  onChange={(e) => setSettingsForm({
                    ...settingsForm,
                    default_message: e.target.value
                  })}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settingsForm.ai_enabled}
                    onCheckedChange={(checked) => setSettingsForm({
                      ...settingsForm,
                      ai_enabled: checked
                    })}
                  />
                  <Label>Respostas Automáticas com IA</Label>
                </div>

                {settingsForm.ai_enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                    <div>
                      <Label>Saudação</Label>
                      <Textarea
                        value={settingsForm.auto_responses.greeting}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          auto_responses: {
                            ...settingsForm.auto_responses,
                            greeting: e.target.value
                          }
                        })}
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>Solicitação de Cardápio</Label>
                      <Textarea
                        value={settingsForm.auto_responses.menu_request}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          auto_responses: {
                            ...settingsForm.auto_responses,
                            menu_request: e.target.value
                          }
                        })}
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>Horário de Funcionamento</Label>
                      <Textarea
                        value={settingsForm.auto_responses.business_hours}
                        onChange={(e) => setSettingsForm({
                          ...settingsForm,
                          auto_responses: {
                            ...settingsForm.auto_responses,
                            business_hours: e.target.value
                          }
                        })}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveSettings}>
                  Salvar Configurações
                </Button>
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EnhancedWhatsAppChatbot;
