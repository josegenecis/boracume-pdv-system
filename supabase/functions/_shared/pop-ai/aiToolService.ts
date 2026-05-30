import type { PopAiConversationStatus, PopAiEngineResult, PopAiSettings } from './types.ts';
import { formatKnowledgeSummary } from './restaurantKnowledgeService.ts';

export const POP_AI_TOOL_NAMES = [
  'getRestaurantInfo',
  'getMenu',
  'searchProducts',
  'getProductDetails',
  'getCustomer',
  'getLastOrder',
  'createOrder',
  'calculateDeliveryFee',
  'generatePixPayment',
  'transferToHuman',
  'pauseAI',
  'saveConversationMessage',
  'getConversationHistory'
];

export function buildPopAiSystemPrompt(settings: PopAiSettings, knowledge: any) {
  const assistantName = settings.assistant_name || 'POP AI';
  const tone = settings.tone || 'simples';
  const rules = String(settings.specific_rules || '').trim();

  return `Você é ${assistantName}, atendente virtual oficial do restaurante ${knowledge.restaurantName}.
Fale em português brasileiro, de forma natural, educada, objetiva e vendedora.
Tom configurado pelo restaurante: ${tone}.
Seu objetivo é atender bem, tirar dúvidas, vender mais e facilitar pedidos pelo WhatsApp.
Use apenas informações reais do restaurante, cardápio, horários, preços e regras disponíveis no sistema.
Nunca invente preço, produto, promoção, prazo, bairro atendido ou taxa.
Nunca fale que é ChatGPT, modelo de IA ou exponha dados internos.
Sempre confirme o pedido antes de finalizar.
Sempre valide produto, variação, complemento obrigatório, disponibilidade e total.
Se não souber responder, se o cliente reclamar, ficar irritado, pedir humano ou tratar assunto sensível, transfira para atendimento humano.
Faça upsell com bom senso quando fizer sentido.

${rules ? `Regras específicas do restaurante:\n${rules}\n` : ''}
Base atual do restaurante:
${formatKnowledgeSummary(knowledge)}`;
}

export function classifyAiStatusFromResult(result: PopAiEngineResult): PopAiConversationStatus {
  const reason = String(result?.reason || '').toLowerCase();
  const reply = String(result?.replyText || '').toLowerCase();
  if (reason.includes('bot_paused')) return 'human_active';
  if (reason.includes('human') || reply.includes('chamar alguém da equipe') || reply.includes('atendente')) return 'human_required';
  if (reason.includes('payment')) return 'waiting_payment';
  if (reason.includes('order') && (reply.includes('pedido confirmado') || reply.includes('chegou no sistema'))) return 'order_confirmed';
  if (reply.includes('qual') || reply.includes('me informe') || reply.includes('posso confirmar') || reply.includes('confirma')) return 'waiting_customer';
  return 'ai_active';
}
