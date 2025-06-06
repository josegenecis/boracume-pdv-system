
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Phone, Bot, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'bot' | 'customer';
  sent_at: string;
}

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string;
  status: string;
  created_at: string;
}

const WhatsAppChatbot = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Buscar conversas
  useEffect(() => {
    if (user?.id) {
      fetchConversations();
    }
  }, [user?.id]);

  // Buscar mensagens da conversa selecionada
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transformar os dados para o tipo correto
      const typedConversations: Conversation[] = (data || []).map(conv => ({
        id: conv.id,
        customer_phone: conv.customer_phone,
        customer_name: conv.customer_name || 'Cliente',
        status: conv.status,
        created_at: conv.created_at
      }));
      
      setConversations(typedConversations);
    } catch (error: any) {
      console.error('Erro ao buscar conversas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      
      // Transformar os dados para o tipo correto
      const typedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender as 'bot' | 'customer',
        sent_at: msg.sent_at
      }));
      
      setMessages(typedMessages);
    } catch (error: any) {
      console.error('Erro ao buscar mensagens:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: selectedConversation,
          content: newMessage,
          sender: 'bot',
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedConversation);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso."
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive"
      });
    }
  };

  const createTestConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .insert({
          user_id: user?.id,
          customer_phone: '+5511999999999',
          customer_name: 'Cliente Teste',
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Criar mensagem inicial
      await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: data.id,
          content: 'Olá! Gostaria de fazer um pedido.',
          sender: 'customer',
          message_type: 'text'
        });

      fetchConversations();
      
      toast({
        title: "Conversa criada",
        description: "Uma conversa de teste foi criada."
      });
    } catch (error: any) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a conversa.",
        variant: "destructive"
      });
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className="mx-auto h-8 w-8 animate-pulse text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WhatsApp Chatbot</h1>
        <Button onClick={createTestConversation} className="flex items-center gap-2">
          <MessageSquare size={16} />
          Criar Conversa Teste
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Lista de Conversas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone size={20} />
              Conversas ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="mx-auto h-8 w-8 mb-2" />
                  <p>Nenhuma conversa ainda</p>
                  <p className="text-xs">Clique em "Criar Conversa Teste"</p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => setSelectedConversation(conversation.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{conversation.customer_name}</p>
                        <p className="text-sm text-gray-500">{conversation.customer_phone}</p>
                      </div>
                      <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                        {conversation.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(conversation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare size={20} />
              {selectedConv ? `Chat com ${selectedConv.customer_name}` : 'Selecione uma conversa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {selectedConversation ? (
              <div className="flex flex-col h-[460px]">
                {/* Mensagens */}
                <div className="flex-1 space-y-3 overflow-y-auto mb-4 p-2 border rounded-lg bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="mx-auto h-8 w-8 mb-2" />
                      <p>Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'bot' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg ${
                            message.sender === 'bot'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {message.sender === 'bot' ? (
                              <Bot size={12} />
                            ) : (
                              <User size={12} />
                            )}
                            <span className="text-xs opacity-75">
                              {message.sender === 'bot' ? 'Bot' : 'Cliente'}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'bot' ? 'text-blue-100' : 'text-gray-400'
                          }`}>
                            {new Date(message.sent_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input de mensagem */}
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 min-h-[60px]"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button onClick={sendMessage} className="self-end">
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[460px] text-gray-500">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 mb-4" />
                  <p>Selecione uma conversa para começar</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona o Chatbot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-medium mb-2">Receba Mensagens</h3>
              <p className="text-sm text-gray-600">
                Clientes enviam mensagens pelo WhatsApp do seu restaurante
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bot className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-medium mb-2">Resposta Automática</h3>
              <p className="text-sm text-gray-600">
                O bot responde automaticamente com o cardápio e opções
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-medium mb-2">Gerencie Conversas</h3>
              <p className="text-sm text-gray-600">
                Acompanhe e responda as conversas diretamente daqui
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppChatbot;
