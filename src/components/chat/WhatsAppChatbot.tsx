
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Send, Phone, Bot, User, Users, Mail, Search, PauseCircle, PlayCircle, Sparkles, Settings, Activity, Save, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'bot' | 'customer' | 'agent';
  sent_at: string;
}

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string;
  status: string;
  created_at: string;
  bot_paused?: boolean;
  bot_paused_at?: string | null;
  ai_conversation_id?: string | null;
  ai_status?: string | null;
  human_required?: boolean | null;
  owner?: string | null;
  current_state?: string | null;
}

interface AiSettings {
  enabled: boolean;
  assistant_name: string;
  tone: string;
  service_style: string;
  order_flow: string;
  welcome_message: string;
  out_of_hours_message: string;
  human_transfer_message: string;
  delivery_rules: string;
  payment_rules: string;
  menu_recommendation_rules: string;
  human_handoff_rules: string;
  forbidden_responses: string;
  upsell_enabled: boolean;
  max_history_messages: number;
  specific_rules: string;
}

interface AiLog {
  id: string;
  action: string;
  input: any;
  output: any;
  error: string | null;
  created_at: string;
}

const defaultAiSettings: AiSettings = {
  enabled: true,
  assistant_name: 'POP AI',
  tone: 'vendedor, cordial e objetivo',
  service_style: 'Atendimento rápido, simpático, parecido com um atendente humano do restaurante.',
  order_flow: 'Enviar o cardápio, ajudar o cliente a escolher e coletar apenas o próximo dado necessário.',
  welcome_message: '',
  out_of_hours_message: '',
  human_transfer_message: 'Vou chamar alguém da equipe para te ajudar.',
  delivery_rules: '',
  payment_rules: '',
  menu_recommendation_rules: 'Recomendar produtos reais do cardápio, combos e itens em destaque quando fizer sentido.',
  human_handoff_rules: 'Chamar atendente em reclamações, cancelamentos, cobrança, erro no pedido ou quando o cliente pedir uma pessoa.',
  forbidden_responses: 'Não inventar preço, prazo, produto, taxa, promoção ou disponibilidade.',
  upsell_enabled: true,
  max_history_messages: 30,
  specific_rules: ''
};

const isBotPaused = (conversation: {
  status?: string | null;
  bot_paused?: boolean | null;
  ai_status?: string | null;
  human_required?: boolean | null;
  owner?: string | null;
  current_state?: string | null;
}) => {
  const status = String(conversation.status || '').trim().toLowerCase();
  const aiStatus = String(conversation.ai_status || '').trim().toLowerCase();
  const owner = String(conversation.owner || '').trim().toUpperCase();
  const currentState = String(conversation.current_state || '').trim().toUpperCase();

  if (status.startsWith('bot_paused_until:')) {
    const until = new Date(status.slice('bot_paused_until:'.length)).getTime();
    if (Number.isFinite(until)) return until > Date.now();
  }

  if (status === 'active' || status === 'ai_active' || aiStatus === 'ai_active' || owner === 'AI') return false;
  if (conversation.human_required || aiStatus === 'human_required' || aiStatus === 'human_active' || owner === 'HUMAN' || currentState === 'HUMAN_ATTENDING') {
    return true;
  }
  if (status === 'bot_paused') return true;

  return Boolean(conversation.bot_paused);
};

const WhatsAppChatbot = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [massMessage, setMassMessage] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeTab, setActiveTab] = useState('conversations');
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [loadingAiLogs, setLoadingAiLogs] = useState(false);

  const buildTemporaryHumanPausePayload = () => {
    const now = new Date();
    const resumeAt = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      status: `bot_paused_until:${resumeAt.toISOString()}`,
      bot_paused: true,
      bot_paused_at: now.toISOString(),
      bot_paused_by: user?.id || null,
      owner: 'HUMAN',
      current_state: 'HUMAN_ATTENDING',
      last_human_message_at: now.toISOString(),
      ai_resume_at: resumeAt.toISOString(),
      metadata: {
        reason: 'manual_agent_message',
        aiResumeAt: resumeAt.toISOString(),
        lastHumanMessageAt: now.toISOString(),
        handoffMode: 'temporary_human_owner'
      },
      updated_at: now.toISOString()
    };
  };

  // Buscar conversas
  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      fetchCustomers();
      fetchAiSettings();
      fetchAiLogs();
    }
  }, [user?.id]);

  // Buscar mensagens da conversa selecionada
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      fetchAiLogs();
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
        created_at: conv.created_at,
        bot_paused: isBotPaused(conv as any),
        bot_paused_at: (conv as any).bot_paused_at || null,
        ai_conversation_id: (conv as any).ai_conversation_id || null,
        ai_status: (conv as any).ai_status || null,
        human_required: (conv as any).human_required || false,
        owner: (conv as any).owner || null,
        current_state: (conv as any).current_state || null
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
        sender: msg.sender as 'bot' | 'customer' | 'agent',
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
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation) return;
    const messageToSend = newMessage.trim();

    try {
      const pausePayload = buildTemporaryHumanPausePayload();

      let { error: pauseError } = await supabase
        .from('whatsapp_conversations')
        .update(pausePayload as any)
        .eq('id', selectedConversation)
        .eq('user_id', user?.id);

      if (pauseError && /bot_paused|owner|current_state|last_human_message_at|ai_resume_at|metadata|schema cache|column/i.test(String(pauseError.message || ''))) {
        const fallbackPausePayload = {
          status: pausePayload.status,
          updated_at: new Date().toISOString()
        };
        const fallbackResult = await supabase
          .from('whatsapp_conversations')
          .update(fallbackPausePayload as any)
          .eq('id', selectedConversation)
          .eq('user_id', user?.id);
        pauseError = fallbackResult.error;
      }

      if (pauseError) throw pauseError;

      const aiPausePayload = {
        status: 'human_active',
        owner: 'HUMAN',
        current_state: 'HUMAN_ATTENDING',
        last_human_message_at: pausePayload.last_human_message_at,
        ai_resume_at: pausePayload.ai_resume_at,
        metadata: {
          ...(pausePayload.metadata || {}),
          legacyConversationId: selectedConversation
        },
        last_message_at: pausePayload.updated_at
      };

      let aiPauseQuery = supabase
        .from('ai_conversations')
        .update(aiPausePayload as any)
        .eq('restaurant_id', user?.id);

      if (conversation.ai_conversation_id) {
        aiPauseQuery = aiPauseQuery.eq('id', conversation.ai_conversation_id);
      } else {
        aiPauseQuery = aiPauseQuery.eq('phone', String(conversation.customer_phone || '').replace(/\D/g, ''));
      }

      const { error: aiPauseError } = await aiPauseQuery;
      if (aiPauseError && !/owner|current_state|last_human_message_at|ai_resume_at|metadata|schema cache|column/i.test(String(aiPauseError.message || ''))) {
        throw aiPauseError;
      }

      const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          number: conversation.customer_phone,
          message: messageToSend
        }
      });

      if (sendError) throw sendError;
      if ((sendResult as any)?.error) {
        throw new Error((sendResult as any)?.message || 'Falha ao enviar mensagem no WhatsApp.');
      }

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: selectedConversation,
          content: messageToSend,
          sender: 'agent',
          message_type: 'text',
          delivered: true
        });

      if (error) throw error;

      setNewMessage('');
      setConversations(prev => prev.map(item => item.id === selectedConversation ? { ...item, ...pausePayload } : item));
      fetchMessages(selectedConversation);
      
      toast({
        title: "Mensagem enviada",
        description: "A IA ficará em silêncio por 60 minutos enquanto o atendente conduz a conversa."
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

  const toggleBotPause = async (conversationId: string, paused: boolean) => {
    try {
      const payload = paused
        ? buildTemporaryHumanPausePayload()
        : {
            status: 'active',
            bot_paused: false,
            bot_paused_at: null,
            bot_paused_by: null,
            owner: 'AI',
            current_state: 'IDLE',
            last_human_message_at: null,
            ai_resume_at: null,
            updated_at: new Date().toISOString()
          };

      let { error } = await supabase
        .from('whatsapp_conversations')
        .update(payload as any)
        .eq('id', conversationId)
        .eq('user_id', user?.id);

      if (error && /bot_paused|owner|current_state|last_human_message_at|ai_resume_at|metadata|schema cache|column/i.test(String(error.message || ''))) {
        const fallbackPayload = {
          status: paused ? String((payload as any).status || 'bot_paused') : 'active',
          updated_at: new Date().toISOString()
        };
        const fallbackResult = await supabase
          .from('whatsapp_conversations')
          .update(fallbackPayload as any)
          .eq('id', conversationId)
          .eq('user_id', user?.id);
        error = fallbackResult.error;
      }

      if (error) throw error;

      const selected = conversations.find(item => item.id === conversationId);
      if (selected?.ai_conversation_id) {
        await supabase
          .from('ai_conversations')
          .update(paused
            ? {
                status: 'human_active',
                owner: 'HUMAN',
                current_state: 'HUMAN_ATTENDING',
                last_human_message_at: (payload as any).last_human_message_at,
                ai_resume_at: (payload as any).ai_resume_at,
                last_message_at: (payload as any).updated_at
              } as any
            : {
                status: 'ai_active',
                owner: 'AI',
                current_state: 'IDLE',
                ai_resume_at: null,
                last_message_at: new Date().toISOString()
              } as any)
          .eq('restaurant_id', user?.id)
          .eq('id', selected.ai_conversation_id);
      }

      setConversations(prev => prev.map(item => item.id === conversationId ? { ...item, ...payload } : item));
      toast({
        title: paused ? 'Robô pausado' : 'Robô reativado',
        description: paused ? 'O cliente não receberá respostas automáticas nesta conversa.' : 'O bot voltará a responder novas mensagens.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível atualizar a pausa do robô.',
        variant: 'destructive'
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes.",
        variant: "destructive"
      });
    }
  };

  const fetchAiSettings = async () => {
    if (!user?.id) return;
    try {
      const [aiResult, whatsappResult] = await Promise.all([
        (supabase as any)
          .from('ai_settings')
          .select('*')
          .eq('restaurant_id', user.id)
          .maybeSingle(),
        supabase
          .from('whatsapp_settings')
          .select('enabled, default_message, auto_responses')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      if (aiResult.error && !String(aiResult.error.message || '').includes('relation "public.ai_settings" does not exist')) {
        throw aiResult.error;
      }

      const data = aiResult.data;
      const autoResponses = (whatsappResult.data?.auto_responses && typeof whatsappResult.data.auto_responses === 'object' && !Array.isArray(whatsappResult.data.auto_responses))
        ? whatsappResult.data.auto_responses as Record<string, any>
        : {};
      const botConfig = (autoResponses.bot_config && typeof autoResponses.bot_config === 'object')
        ? autoResponses.bot_config as Record<string, any>
        : {};
      const metadata = (data?.metadata && typeof data.metadata === 'object') ? data.metadata : {};

      if (data) {
        setAiSettings({
          enabled: data.enabled !== false,
          assistant_name: data.assistant_name || 'POP AI',
          tone: data.tone || botConfig.tone || defaultAiSettings.tone,
          service_style: metadata.service_style || botConfig.service_style || defaultAiSettings.service_style,
          order_flow: metadata.order_flow || botConfig.order_flow || defaultAiSettings.order_flow,
          welcome_message: data.welcome_message || botConfig.welcome_message || '',
          out_of_hours_message: data.out_of_hours_message || '',
          human_transfer_message: data.human_transfer_message || defaultAiSettings.human_transfer_message,
          delivery_rules: metadata.delivery_rules || botConfig.delivery_rules || '',
          payment_rules: metadata.payment_rules || botConfig.payment_rules || '',
          menu_recommendation_rules: metadata.menu_recommendation_rules || botConfig.menu_recommendation_rules || defaultAiSettings.menu_recommendation_rules,
          human_handoff_rules: metadata.human_handoff_rules || botConfig.human_handoff_rules || defaultAiSettings.human_handoff_rules,
          forbidden_responses: Array.isArray(data.forbidden_responses)
            ? data.forbidden_responses.join('\n')
            : botConfig.forbidden_responses || defaultAiSettings.forbidden_responses,
          upsell_enabled: data.upsell_enabled !== false,
          max_history_messages: Number(data.max_history_messages || 30),
          specific_rules: data.specific_rules || ''
        });
      } else if (Object.keys(botConfig).length || whatsappResult.data) {
        setAiSettings(prev => ({
          ...prev,
          enabled: whatsappResult.data?.enabled !== false,
          assistant_name: botConfig.assistant_name || prev.assistant_name,
          tone: botConfig.tone || prev.tone,
          service_style: botConfig.service_style || prev.service_style,
          order_flow: botConfig.order_flow || prev.order_flow,
          welcome_message: botConfig.welcome_message || whatsappResult.data?.default_message || prev.welcome_message,
          human_transfer_message: botConfig.human_transfer_message || prev.human_transfer_message,
          delivery_rules: botConfig.delivery_rules || prev.delivery_rules,
          payment_rules: botConfig.payment_rules || prev.payment_rules,
          menu_recommendation_rules: botConfig.menu_recommendation_rules || prev.menu_recommendation_rules,
          human_handoff_rules: botConfig.human_handoff_rules || prev.human_handoff_rules,
          forbidden_responses: botConfig.forbidden_responses || prev.forbidden_responses,
          specific_rules: botConfig.specific_rules || prev.specific_rules,
        }));
      }
    } catch (error: any) {
      console.error('Erro ao carregar POP AI:', error);
    }
  };

  const saveAiSettings = async () => {
    if (!user?.id) return;
    setSavingAiSettings(true);
    try {
      const payload = {
        restaurant_id: user.id,
        enabled: aiSettings.enabled,
        assistant_name: aiSettings.assistant_name || 'POP AI',
        tone: aiSettings.tone || defaultAiSettings.tone,
        welcome_message: aiSettings.welcome_message || null,
        out_of_hours_message: aiSettings.out_of_hours_message || null,
        human_transfer_message: aiSettings.human_transfer_message || defaultAiSettings.human_transfer_message,
        upsell_enabled: aiSettings.upsell_enabled,
        max_history_messages: Math.min(80, Math.max(10, Number(aiSettings.max_history_messages || 30))),
        forbidden_responses: aiSettings.forbidden_responses
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        specific_rules: aiSettings.specific_rules || null,
        metadata: {
          service_style: aiSettings.service_style,
          order_flow: aiSettings.order_flow,
          delivery_rules: aiSettings.delivery_rules,
          payment_rules: aiSettings.payment_rules,
          menu_recommendation_rules: aiSettings.menu_recommendation_rules,
          human_handoff_rules: aiSettings.human_handoff_rules,
        },
        updated_at: new Date().toISOString()
      };

      const { error } = await (supabase as any)
        .from('ai_settings')
        .upsert(payload, { onConflict: 'restaurant_id' });

      if (error && !String(error.message || '').includes('relation "public.ai_settings" does not exist')) throw error;

      const { data: existingWhatsapp } = await supabase
        .from('whatsapp_settings')
        .select('auto_responses, phone_number, default_message')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentAutoResponses = (existingWhatsapp?.auto_responses && typeof existingWhatsapp.auto_responses === 'object' && !Array.isArray(existingWhatsapp.auto_responses))
        ? existingWhatsapp.auto_responses as Record<string, any>
        : {};
      const botConfig = {
        assistant_name: payload.assistant_name,
        tone: payload.tone,
        service_style: aiSettings.service_style,
        order_flow: aiSettings.order_flow,
        welcome_message: aiSettings.welcome_message,
        out_of_hours_message: aiSettings.out_of_hours_message,
        human_transfer_message: aiSettings.human_transfer_message,
        delivery_rules: aiSettings.delivery_rules,
        payment_rules: aiSettings.payment_rules,
        menu_recommendation_rules: aiSettings.menu_recommendation_rules,
        human_handoff_rules: aiSettings.human_handoff_rules,
        forbidden_responses: aiSettings.forbidden_responses,
        specific_rules: aiSettings.specific_rules,
        upsell_enabled: aiSettings.upsell_enabled,
        max_history_messages: payload.max_history_messages,
      };

      const { error: whatsappError } = await supabase
        .from('whatsapp_settings')
        .upsert({
          user_id: user.id,
          phone_number: existingWhatsapp?.phone_number || '',
          default_message: aiSettings.welcome_message || existingWhatsapp?.default_message || 'Olá! Gostaria de fazer um pedido.',
          enabled: true,
          ai_enabled: aiSettings.enabled,
          auto_responses: {
            ...currentAutoResponses,
            welcome: aiSettings.welcome_message || currentAutoResponses.welcome,
            bot_config: botConfig,
          },
          updated_at: new Date().toISOString()
        } as any, { onConflict: 'user_id' });

      if (whatsappError) throw whatsappError;

      toast({
        title: 'POP AI atualizado',
        description: 'As regras do atendente virtual foram salvas.'
      });
      fetchAiSettings();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o POP AI.',
        variant: 'destructive'
      });
    } finally {
      setSavingAiSettings(false);
    }
  };

  const fetchAiLogs = async () => {
    if (!user?.id) return;
    setLoadingAiLogs(true);
    try {
      let query = (supabase as any)
        .from('ai_logs')
        .select('*')
        .eq('restaurant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      const current = conversations.find(item => item.id === selectedConversation);
      if (current?.ai_conversation_id) {
        query = query.eq('conversation_id', current.ai_conversation_id);
      }

      const { data, error } = await query;
      if (error && !String(error.message || '').includes('relation "public.ai_logs" does not exist')) {
        throw error;
      }
      setAiLogs(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar logs POP AI:', error);
    } finally {
      setLoadingAiLogs(false);
    }
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const selectAllCustomers = () => {
    const filteredCustomers = customers.filter(customer =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone.includes(customerSearch)
    );
    setSelectedCustomers(filteredCustomers.map(c => c.id));
  };

  const clearSelection = () => {
    setSelectedCustomers([]);
  };

  const sendMassMessage = async () => {
    if (!massMessage.trim() || selectedCustomers.length === 0) return;

    try {
      // Aqui você implementaria o envio real das mensagens
      // Por agora, vamos simular
      
      toast({
        title: "Mensagens enviadas",
        description: `Mensagem enviada para ${selectedCustomers.length} cliente(s).`
      });
      
      setMassMessage('');
      setSelectedCustomers([]);
    } catch (error: any) {
      console.error('Erro ao enviar mensagens:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar as mensagens.",
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

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.phone.includes(customerSearch)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gradient-to-r from-emerald-950 via-emerald-900 to-orange-600 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
              <Sparkles size={14} />
              POP AI
            </div>
            <h1 className="text-3xl font-bold">Atendente Virtual Inteligente</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/85">
              Atendimento pelo WhatsApp com memória, cardápio inteligente, montagem de pedidos e transferência para humano quando precisar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={aiSettings.enabled ? 'bg-lime-400 text-emerald-950' : 'bg-red-100 text-red-700'}>
              {aiSettings.enabled ? 'IA ativa' : 'IA pausada'}
            </Badge>
            <Button onClick={createTestConversation} variant="secondary" className="flex items-center gap-2">
              <MessageSquare size={16} />
              Criar Conversa Teste
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare size={16} />
            Conversas ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users size={16} />
            Clientes ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings size={16} />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity size={16} />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-6">

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
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                          {conversation.status}
                        </Badge>
                        {conversation.bot_paused && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                            Robô pausado
                          </Badge>
                        )}
                        {conversation.ai_status && (
                          <Badge variant="outline" className={conversation.human_required ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
                            {conversation.human_required ? 'Humano' : conversation.ai_status}
                          </Badge>
                        )}
                      </div>
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
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <MessageSquare size={20} />
                {selectedConv ? `Chat com ${selectedConv.customer_name}` : 'Selecione uma conversa'}
              </span>
              {selectedConv && (
                <Button
                  type="button"
                  variant={isBotPaused(selectedConv) ? 'outline' : 'secondary'}
                  size="sm"
                  onClick={() => toggleBotPause(selectedConv.id, !isBotPaused(selectedConv))}
                  className="gap-2"
                >
                  {isBotPaused(selectedConv) ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                  {isBotPaused(selectedConv) ? 'Reativar robô' : 'Pausar robô'}
                </Button>
              )}
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
                        className={`flex ${message.sender === 'bot' || message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg ${
                            message.sender === 'bot' || message.sender === 'agent'
                              ? message.sender === 'agent' ? 'bg-green-600 text-white' : 'bg-blue-500 text-white'
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
                              {message.sender === 'bot' ? 'Bot' : message.sender === 'agent' ? 'Atendente' : 'Cliente'}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.sender === 'bot' || message.sender === 'agent' ? 'text-white/80' : 'text-gray-400'
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
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Clientes Cadastrados ({customers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca e filtros */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={selectedCustomers.length === filteredCustomers.length ? clearSelection : selectAllCustomers}
                >
                  {selectedCustomers.length === filteredCustomers.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>

              {/* Lista de clientes */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="mx-auto h-8 w-8 mb-2" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedCustomers.includes(customer.id) ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => toggleCustomerSelection(customer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.phone}</p>
                          {customer.address && (
                            <p className="text-xs text-gray-400">{customer.address}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            Cadastrado em {new Date(customer.created_at).toLocaleDateString()}
                          </p>
                          {selectedCustomers.includes(customer.id) && (
                            <Badge variant="default" className="mt-1">Selecionado</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Mensagem em massa */}
              {selectedCustomers.length > 0 && (
                <div className="mt-6 p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-blue-600" />
                    <span className="font-medium text-blue-800">
                      Enviar mensagem para {selectedCustomers.length} cliente(s)
                    </span>
                  </div>
                  <Textarea
                    value={massMessage}
                    onChange={(e) => setMassMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="mb-2"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={sendMassMessage} disabled={!massMessage.trim()}>
                      <Send size={16} className="mr-2" />
                      Enviar Mensagem
                    </Button>
                    <Button variant="outline" onClick={clearSelection}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles size={20} />
                  Cérebro do POP AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold">Nome do atendente</span>
                    <Input
                      value={aiSettings.assistant_name}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, assistant_name: e.target.value }))}
                      placeholder="POP AI"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold">Tom de voz</span>
                    <Input
                      value={aiSettings.tone}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, tone: e.target.value }))}
                      placeholder="simples, vendedor, divertido..."
                    />
                  </label>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Saudação inicial</span>
                  <Textarea
                    value={aiSettings.welcome_message}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, welcome_message: e.target.value }))}
                    placeholder="Olá! Como posso te ajudar hoje?"
                    rows={3}
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">Estilo de atendimento</span>
                    <Textarea
                      value={aiSettings.service_style}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, service_style: e.target.value }))}
                      placeholder="Ex: atendimento rápido, simpático, informal, chamando o cliente pelo nome quando souber."
                      rows={4}
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">Fluxo ideal de pedido</span>
                    <Textarea
                      value={aiSettings.order_flow}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, order_flow: e.target.value }))}
                      placeholder="Ex: primeiro enviar cardápio, depois confirmar retirada/entrega, forma de pagamento e nome."
                      rows={4}
                    />
                  </label>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Mensagem fora de horário</span>
                  <Textarea
                    value={aiSettings.out_of_hours_message}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, out_of_hours_message: e.target.value }))}
                    placeholder="Agora estamos fechados, mas posso deixar seu pedido encaminhado."
                    rows={3}
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">Regras de entrega</span>
                    <Textarea
                      value={aiSettings.delivery_rules}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, delivery_rules: e.target.value }))}
                      placeholder="Ex: atende até 5km, taxa depende do bairro, não prometer prazo exato sem confirmação."
                      rows={4}
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">Regras de pagamento</span>
                    <Textarea
                      value={aiSettings.payment_rules}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, payment_rules: e.target.value }))}
                      placeholder="Ex: aceitar Pix, dinheiro e cartão; perguntar troco quando for dinheiro."
                      rows={4}
                    />
                  </label>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Como recomendar produtos e combos</span>
                  <Textarea
                    value={aiSettings.menu_recommendation_rules}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, menu_recommendation_rules: e.target.value }))}
                    placeholder="Ex: sugerir combos para família, bebidas com pastel, adicionais no açaí, produtos em destaque primeiro."
                    rows={3}
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Transferência para humano</span>
                  <Textarea
                    value={aiSettings.human_transfer_message}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, human_transfer_message: e.target.value }))}
                    rows={2}
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Quando chamar atendente humano</span>
                  <Textarea
                    value={aiSettings.human_handoff_rules}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, human_handoff_rules: e.target.value }))}
                    placeholder="Ex: reclamações, pedido atrasado, cancelamento, cliente irritado, dúvidas fiscais, alteração de pedido já enviado."
                    rows={3}
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Regras específicas do restaurante</span>
                  <Textarea
                    value={aiSettings.specific_rules}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, specific_rules: e.target.value }))}
                    placeholder="Ex: nunca oferecer entrega fora do bairro X; priorizar combo família; pedir ponto da carne..."
                    rows={5}
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Coisas que o bot nunca deve responder/prometer</span>
                  <Textarea
                    value={aiSettings.forbidden_responses}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, forbidden_responses: e.target.value }))}
                    placeholder="Uma regra por linha. Ex: não prometer entrega em 20 minutos; não dar desconto sem autorização."
                    rows={4}
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="rounded-lg border p-4">
                    <span className="text-sm font-semibold">IA ativa</span>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={aiSettings.enabled}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="h-5 w-5 accent-green-600"
                      />
                      <span className="text-sm text-gray-600">{aiSettings.enabled ? 'Atendendo' : 'Pausada'}</span>
                    </div>
                  </label>
                  <label className="rounded-lg border p-4">
                    <span className="text-sm font-semibold">Upsell inteligente</span>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={aiSettings.upsell_enabled}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, upsell_enabled: e.target.checked }))}
                        className="h-5 w-5 accent-green-600"
                      />
                      <span className="text-sm text-gray-600">{aiSettings.upsell_enabled ? 'Ligado' : 'Desligado'}</span>
                    </div>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold">Memória da conversa</span>
                    <Input
                      type="number"
                      min={10}
                      max={80}
                      value={aiSettings.max_history_messages}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, max_history_messages: Number(e.target.value || 30) }))}
                    />
                  </label>
                </div>

                <Button onClick={saveAiSettings} disabled={savingAiSettings} className="gap-2">
                  {savingAiSettings ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar POP AI
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primeira versão ativa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                  Recebe WhatsApp, identifica restaurante e cliente, grava memória, consulta cardápio, monta pedido simples e registra logs.
                </div>
                <div className="rounded-lg bg-orange-50 p-3 text-orange-800">
                  Quando o humano responde pelo painel ou WhatsApp Web, a conversa é pausada para evitar o robô atrapalhar.
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-slate-700">
                  Próximos blocos naturais: PIX automático, pedidos recorrentes, resposta por áudio e campanhas acionadas por comportamento.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Activity size={20} />
                  Logs do POP AI
                </span>
                <Button variant="outline" size="sm" onClick={fetchAiLogs} className="gap-2">
                  <RefreshCw size={16} className={loadingAiLogs ? 'animate-spin' : ''} />
                  Atualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiLogs.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <Activity className="mx-auto mb-3 h-8 w-8" />
                  <p>Nenhum log do POP AI ainda.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[620px] overflow-y-auto">
                  {aiLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border bg-white p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={log.error ? 'destructive' : 'outline'}>{log.action}</Badge>
                        <span className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      {log.error && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{log.error}</p>}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                        <pre className="max-h-44 overflow-auto rounded bg-slate-50 p-3">{JSON.stringify(log.input || {}, null, 2)}</pre>
                        <pre className="max-h-44 overflow-auto rounded bg-emerald-50 p-3">{JSON.stringify(log.output || {}, null, 2)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppChatbot;
