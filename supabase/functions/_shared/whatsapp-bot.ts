// deno-lint-ignore-file no-explicit-any
import { buildMenuShareUrl, buildPhoneCandidates, buildTrackShareUrl, fillTemplate, loadRestaurantContext, normalizePhone, sendRestaurantWhatsApp } from './restaurant-whatsapp.ts';

function getEnv(name: string, fallback = '') {
  return String(Deno.env.get(name) || fallback).trim();
}

function toTextFromHistoryItem(item: any) {
  return String(item?.content || '').trim();
}

function isGreeting(text: string) {
  return /^(oi+|ol[áa]+|opa+|bom dia|boa tarde|boa noite|e ai|e aí)\b/i.test(text.trim());
}

function wantsMenuLink(text: string) {
  return /(link|card[aá]pio|cat[aá]logo|menu|me envia|me manda|manda o link|envia o link|me passa o link)/i.test(text);
}

function wantsOrderTracking(text: string) {
  return /(acompanh|rastre|status do pedido|meu pedido|onde.*pedido|pedido.*andamento|pedido.*status)/i.test(text);
}

function wantsOpeningHours(text: string) {
  const value = normalizeIntentText(text);
  return /(que\s*horas.*(abre|abrem|abrir|fecha|fecham|fechar)|horario|hora.*funcion|funcionamento|abre\s*que\s*horas|fecha\s*que\s*horas|voce?s?\s*(abre|abrem|fecha|fecham)|at[eé]?\s*que\s*horas|qual\s*o\s*horario)/i.test(value);
}

function wantsComplementsInfo(text: string) {
  const value = normalizeIntentText(text);
  return /(complemento|complementos|adicional|adicionais|acompanhamento|acompanhamentos|opcoes|opções|sabor|sabores|tem.*granola|tem.*leite|tem.*banana)/i.test(value);
}

function wantsPromotions(text: string) {
  return /(promo[cç][aã]o|promo|desconto|oferta|ofertas|tem combo|tem combos|tem alguma promo|alguma promo[cç][aã]o)/i.test(text);
}

function isThanks(text: string) {
  return /(obrigad[oa]?|valeu+|agrade[cç]o|tmj|show|perfeito|maravilha|blz|beleza)\b/i.test(text.trim());
}

function normalizeIntentText(text: string) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const GENERIC_MATCH_WORDS = new Set([
  'com', 'sem', 'para', 'por', 'pra', 'uma', 'uns', 'das', 'dos', 'que', 'tem',
  'sistema', 'pedido', 'pedidos', 'pagamento', 'pagamentos', 'opcao', 'opcoes',
  'opção', 'opções', 'troco', 'automatico', 'automático', 'atualizar', 'reinicia'
]);

function relevantTokens(value: string) {
  return normalizeForMatch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_MATCH_WORDS.has(token));
}

function isLowSignalMessage(text: string) {
  const value = normalizeIntentText(text).replace(/[!?.\s]+$/g, '');
  if (!value) return true;
  return /^(ok|okay|certo|ta|t[aá]|ta bom|t[aá] bom|beleza|blz|show|sim|nao|não|obg|obrigado|obrigada|valeu|vlw|👍|👌)$/.test(value);
}

function wantsHumanAttendance(text: string) {
  const value = normalizeIntentText(text);
  return /(atendente|humano|pessoa|falar com alguem|falar com alguém|responsavel|responsável|gerente|dono|suporte|me liga|ligar|telefone)/i.test(value);
}

function isComplaintOrProblem(text: string) {
  const value = normalizeIntentText(text);
  return /(reclama|problema|errado|atras|atrasado|demora|demorando|frio|faltou|faltando|cance|cancelar|ruim|horrivel|péssimo|pessimo|devolu|estorno|reembolso)/i.test(value);
}

function isMarketingOptOut(text: string) {
  const value = normalizeIntentText(text);
  return /^(sair|parar|cancelar ofertas|remover|nao quero|nao receber|sem ofertas)\b/.test(value);
}

function getLocalDayKey(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isSameLocalDay(value?: string | null) {
  const key = getLocalDayKey(value);
  return Boolean(key && key === getLocalDayKey());
}

function ensureMenuLink(text: string, menuLink: string) {
  const message = String(text || '').trim();
  const normalizedLink = String(menuLink || '').trim();
  if (!normalizedLink) return message;
  if (!message) return `📋 Confira nosso cardápio: ${normalizedLink}`;
  if (message.includes(normalizedLink)) return message;
  return `${message}\n\n📋 Cardápio: ${normalizedLink}`;
}

function buildOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'recebido',
    preparing: 'em preparo',
    ready: 'pronto',
    in_delivery: 'saiu para entrega',
    delivered: 'entregue',
    completed: 'finalizado',
    cancelled: 'cancelado'
  };
  return labels[String(status || '').trim()] || String(status || 'em andamento');
}

function formatOpeningHours(openingHours: string) {
  const raw = String(openingHours || '').trim();
  if (!raw) return '';
  const dayLabels: Record<string, string> = {
    monday: 'segunda-feira',
    tuesday: 'terça-feira',
    wednesday: 'quarta-feira',
    thursday: 'quinta-feira',
    friday: 'sexta-feira',
    saturday: 'sábado',
    sunday: 'domingo',
    segunda: 'segunda-feira',
    terca: 'terça-feira',
    terça: 'terça-feira',
    quarta: 'quarta-feira',
    quinta: 'quinta-feira',
    sexta: 'sexta-feira',
    sabado: 'sábado',
    sábado: 'sábado',
    domingo: 'domingo'
  };

  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed)
      ? parsed
      : Object.entries(parsed || {}).map(([day, value]: [string, any]) => ({ day, ...(value || {}) }));
    const lines = rows
      .filter((row: any) => row && row.closed !== true)
      .map((row: any) => {
        const dayKey = normalizeIntentText(String(row.day || row.weekday || row.name || ''));
        const day = dayLabels[dayKey] || String(row.day || row.weekday || '').trim();
        const open = String(row.open || row.opens || row.start || '').trim();
        const close = String(row.close || row.closes || row.end || '').trim();
        if (!day || !open || !close) return '';
        return `${day}: ${open} às ${close}`;
      })
      .filter(Boolean);
    if (lines.length) return lines.join('\n');
  } catch {
    // Horário antigo salvo como texto simples.
  }

  return raw
    .replace(/"?(monday)"?/gi, 'segunda-feira')
    .replace(/"?(tuesday)"?/gi, 'terça-feira')
    .replace(/"?(wednesday)"?/gi, 'quarta-feira')
    .replace(/"?(thursday)"?/gi, 'quinta-feira')
    .replace(/"?(friday)"?/gi, 'sexta-feira')
    .replace(/"?(saturday)"?/gi, 'sábado')
    .replace(/"?(sunday)"?/gi, 'domingo')
    .replace(/[{}\[\]"]/g, '')
    .replace(/\bopen\b/gi, 'abre')
    .replace(/\bclose\b/gi, 'fecha')
    .replace(/\bclosed\s*:\s*false\b/gi, '')
    .replace(/\s*,\s*/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildOpeningHoursReply(restaurantName: string, openingHours: string, restaurantId: string) {
  const formatted = formatOpeningHours(openingHours);
  return formatted
    ? `Olá! O ${restaurantName} funciona nestes horários:\n${formatted}\n\nPosso te ajudar com o cardápio, montar um pedido ou consultar status de um pedido.`
    : `Olá! Ainda não encontrei o horário de funcionamento cadastrado do ${restaurantName}. Posso te ajudar com o cardápio ou montar seu pedido por aqui.`;
}

function buildPromotionsReply(restaurantName: string, restaurantId: string, products: any[]) {
  const promoProducts = (products || []).filter((product: any) => {
    const discount = Number(product?.discount_percentage || 0);
    const price = Number(product?.price || 0);
    const originalPrice = Number(product?.original_price || 0);
    return discount > 0 || (originalPrice > 0 && originalPrice > price) || Boolean(product?.is_highlight);
  }).slice(0, 3);

  if (promoProducts.length === 0) {
    return `✨ No momento não encontrei promoções ativas no ${restaurantName}, mas posso te enviar o cardápio completo: ${buildMenuShareUrl(restaurantId)}`;
  }

  const lines = promoProducts.map((product: any) => {
    const name = String(product?.name || 'Item').trim();
    const price = Number(product?.price || 0).toFixed(2);
    const originalPrice = Number(product?.original_price || 0);
    const discount = Number(product?.discount_percentage || 0);
    if (discount > 0) {
      return `- ${name}: R$ ${price} (${discount}% OFF)`;
    }
    if (originalPrice > 0 && originalPrice > Number(product?.price || 0)) {
      return `- ${name}: de R$ ${originalPrice.toFixed(2)} por R$ ${price}`;
    }
    return `- ${name}: R$ ${price}`;
  });

  return `✨ Hoje no ${restaurantName} encontrei estas opções em destaque:\n${lines.join('\n')}\n\n📋 Cardápio completo: ${buildMenuShareUrl(restaurantId)}`;
}

function formatBRL(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function findMentionedProducts(text: string, products: any[]) {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText || !Array.isArray(products)) return [];

  const tokens = relevantTokens(text);
  if (tokens.length === 0) return [];

  return products
    .map((product: any) => {
      const name = String(product?.name || '').trim();
      const normalizedName = normalizeForMatch(name);
      if (!name || !normalizedName) return null;
      const direct = normalizedText.includes(normalizedName);
      const nameTokens = relevantTokens(name);
      const score = direct
        ? 100
        : nameTokens.filter((token) => tokens.includes(token)).length;
      return score > 0 ? { product, score } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3)
    .map((item: any) => item.product);
}

function wantsProductInfo(text: string) {
  const value = normalizeIntentText(text);
  return /(tem|voces tem|vocês tem|quanto|preco|preço|valor|vende|disponivel|disponível|serve|cardapio|cardápio)/i.test(value);
}

function buildProductInfoReply(restaurantId: string, products: any[]) {
  const lines = products.map((product: any) => `- ${String(product?.name || 'Produto').trim()}: ${formatBRL(product?.price)}`);
  return `${products.length === 1 ? 'Temos sim:' : 'Encontrei essas opções:'}\n${lines.join('\n')}\n\nPara pedir, acesse o cardápio: ${buildMenuShareUrl(restaurantId)}`;
}

function wantsToOrder(text: string) {
  const value = normalizeIntentText(text);
  return /(quero|queria|gostaria|vou querer|manda|separa|pode fazer|posso fazer|fazer pedido|pedir|pedido|adiciona|coloca|fechar pedido|finalizar pedido|confirmar pedido|confirmo|pode confirmar|isso mesmo|entrega|retirada|pix|dinheiro|cartao|cartão)/i.test(value);
}

function isOrderConfirmation(text: string) {
  const value = normalizeIntentText(text);
  return /^(confirmo|confirmar|pode confirmar|isso|isso mesmo|fechado|fecha|finalizar|sim pode|sim|ok pode|tudo certo)\b/.test(value);
}

function isOrderCancel(text: string) {
  const value = normalizeIntentText(text);
  return /^(cancelar|cancela|apagar|limpar|desistir|nao quero|não quero)\b/.test(value);
}

function parseMoneyFromText(text: string) {
  const match = String(text || '').match(/(?:r\$\s*)?(\d{1,4})(?:[,.](\d{1,2}))?/i);
  if (!match) return null;
  const value = Number(`${match[1]}.${(match[2] || '00').padEnd(2, '0')}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseQuantityFromText(text: string) {
  const normalized = normalizeIntentText(text);
  const numeric = normalized.match(/^\s*(\d{1,2})\b(?![,.]\d)|\b(\d{1,2})\s*(x|un|unidade|unidades)\b/);
  if (numeric) return Math.max(1, Math.min(50, Number(numeric[1] || numeric[2]) || 1));
  if (/\b(um|uma)\b/.test(normalized)) return 1;
  if (/\b(dois|duas)\b/.test(normalized)) return 2;
  if (/\b(tres|três)\b/.test(normalized)) return 3;
  return 1;
}

function parseVariationOptions(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw.split(/[,;\n]/).map((name) => ({ name: String(name).trim(), price: 0 })).filter((item) => item.name);
    }
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([name, price]) => ({ name, price: Number(price) || 0 }));
  }
  return [];
}

function optionPrice(option: any) {
  return Math.max(0, Number(option?.price ?? option?.base_price ?? 0) || 0);
}

function normalizeForMatch(value: unknown) {
  return normalizeIntentText(String(value || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function expandOptionSynonyms(value: string) {
  const normalized = normalizeForMatch(value);
  const extras: string[] = [];
  if (/\bleite\b/.test(normalized) && /\b(po|ninho|condensado)\b/.test(normalized)) extras.push('leite');
  if (/\bleite em po\b/.test(normalized)) extras.push('leite ninho', 'leite po', 'ninho');
  if (/\bleite condensado\b/.test(normalized)) extras.push('condensado');
  if (/\bbanana\b/.test(normalized)) extras.push('bananas');
  return Array.from(new Set([normalized, ...extras].filter(Boolean)));
}

function optionMatchesText(optionName: unknown, text: string) {
  const option = normalizeForMatch(optionName);
  const source = normalizeForMatch(text);
  if (!option || !source) return false;
  const sourceWordCount = source.split(/\s+/).filter(Boolean).length;
  if (option.length >= 3 && source.includes(option)) return true;
  if (sourceWordCount <= 3 && source.length >= 3 && option.includes(source)) return true;
  const sourceSynonyms = expandOptionSynonyms(source).filter((variant) => variant !== source);
  const optionSynonyms = expandOptionSynonyms(option).filter((variant) => variant !== option);
  if (sourceSynonyms.some((variant) => variant.length >= 3 && option.includes(variant))) return true;
  if (optionSynonyms.some((variant) => variant.length >= 3 && source.includes(variant))) return true;
  const optionTokens = option.split(/\s+/).filter((token) => token.length >= 3);
  const sourceTokens = source.split(/\s+/).filter((token) => token.length >= 3);
  if (optionTokens.length === 0 || sourceTokens.length === 0) return false;
  const hits = optionTokens.filter((token) => sourceTokens.includes(token)).length;
  return hits >= Math.min(2, optionTokens.length);
}

function productMatchScore(text: string, product: any, desiredPrice: number | null) {
  const normalizedText = normalizeForMatch(text);
  const name = normalizeForMatch(product?.name);
  const category = normalizeForMatch(product?.category);
  if (!name) return 0;

  const nameTokens = relevantTokens(String(product?.name || ''));
  const categoryTokens = relevantTokens(String(product?.category || ''));
  const tokenHits = nameTokens.filter((token) => normalizedText.includes(token)).length;
  const categoryHits = categoryTokens.filter((token) => normalizedText.includes(token)).length;
  let score = normalizedText.includes(name) ? 100 : tokenHits * 12;
  if (category && normalizedText.includes(category)) score += 15;
  if (categoryHits > 0) score += categoryHits * 18;
  if (desiredPrice !== null && Math.abs(Number(product?.price || 0) - desiredPrice) <= 0.01) score += 45;
  if (desiredPrice !== null && categoryHits > 0) score += 25;
  if (String(product?.available) === 'false') score -= 80;
  return score;
}

function findBestProduct(text: string, products: any[]) {
  const desiredPrice = parseMoneyFromText(text);
  const ranked = (products || [])
    .map((product: any) => ({ product, score: productMatchScore(text, product, desiredPrice) }))
    .filter((item: any) => item.score > 0)
    .sort((a: any, b: any) => b.score - a.score);
  return ranked[0]?.score >= 12 ? ranked[0].product : null;
}

function findBestProductByIntent(item: any, products: any[]) {
  const text = [item?.product, item?.name, item?.category, item?.raw_text].filter(Boolean).join(' ');
  const desiredPrice = item?.target_price !== undefined && item?.target_price !== null
    ? Number(item.target_price)
    : parseMoneyFromText(text);
  const safeDesiredPrice = typeof desiredPrice === 'number' && Number.isFinite(desiredPrice) && desiredPrice > 0 ? desiredPrice : null;
  const ranked = (products || [])
    .map((product: any) => ({ product, score: productMatchScore(text, product, safeDesiredPrice) }))
    .filter((entry: any) => entry.score > 0)
    .sort((a: any, b: any) => b.score - a.score);
  return ranked[0]?.score >= 12 ? ranked[0].product : null;
}

function hasProductClue(text: string) {
  const value = normalizeIntentText(text);
  if (parseMoneyFromText(text) !== null) return true;
  if (/(a[cç]a[ií]|pizza|hamb[uú]rguer|burger|bebida|suco|refrigerante|combo|copo|barca|marmita|lanche|por[cç][aã]o|pastel|agua|água)/i.test(value)) return true;
  return relevantTokens(text).some((token) => token.length >= 4 && !/(gostaria|fazer|posso|pedido|pedir|quero|queria)/i.test(token));
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = String(value || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function compactMenuForAi(products: any[], variationsByProduct: Map<string, any[]>) {
  return (products || []).slice(0, 140).map((product: any) => {
    const variations = (variationsByProduct.get(String(product?.id)) || []).slice(0, 8).map((variation: any) => ({
      name: String(variation?.name || ''),
      required: Boolean(variation?.required),
      max_selections: Number(variation?.max_selections || 1),
      options: parseVariationOptions(variation?.options).slice(0, 30).map((option: any) => ({
        name: String(option?.name || ''),
        price: optionPrice(option)
      }))
    }));
    return {
      id: String(product?.id || ''),
      name: String(product?.name || ''),
      category: String(product?.category || ''),
      price: Number(product?.price || 0),
      variations
    };
  });
}

async function callOrderBrain(params: {
  message: string;
  restaurantName: string;
  customerName: string;
  draft: any;
  products: any[];
  variationsByProduct: Map<string, any[]>;
  history?: Array<{ sender?: string; content?: string }>;
}) {
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) return null;

  const model = getEnv('OPENAI_ORDER_MODEL', getEnv('OPENAI_BOT_MODEL', getEnv('OPENAI_MODEL', 'gpt-4.1-mini')));
  const menu = compactMenuForAi(params.products, params.variationsByProduct);
  const historyText = (params.history || [])
    .slice(-8)
    .map((item: any) => `${item?.sender === 'bot' ? 'Atendente' : 'Cliente'}: ${String(item?.content || '').slice(0, 300)}`)
    .join('\n');

  const system = [
    'Voce e o cerebro de pedidos por WhatsApp do PopSystem para restaurantes.',
    'Sua tarefa e interpretar a mensagem do cliente e devolver SOMENTE JSON valido.',
    'Nao crie produto, preco ou complemento fora do cardapio fornecido.',
    'Se o cliente quer pedir, mesmo sem item, intent deve ser "order_start".',
    'Se o cliente confirma um pedido pronto, intent deve ser "confirm_order".',
    'Se o cliente quer cancelar/limpar/desistir, intent deve ser "cancel_order".',
    'Se a mensagem e administrativa/suporte e nao e cliente comprando comida, intent deve ser "other".',
    'Extraia itens mesmo quando o cliente fala por valor: "acai de 15", "um copo de 20".',
    'Formato obrigatorio:',
    '{"intent":"order_start|add_items|update_details|confirm_order|cancel_order|other|human_handoff","items":[{"product":"nome ou categoria","quantity":1,"target_price":15,"options":["granola"],"notes":""}],"customer_name":null,"order_type":null,"address":null,"payment_method":null,"assistant_hint":""}',
    'order_type: delivery ou pickup. payment_method: pix, dinheiro ou cartao.'
  ].join('\n');

  const user = [
    `Restaurante: ${params.restaurantName}`,
    `Cliente conhecido: ${params.customerName}`,
    `Rascunho atual: ${JSON.stringify(params.draft || null).slice(0, 5000)}`,
    `Historico recente:\n${historyText || '-'}`,
    `Cardapio JSON:\n${JSON.stringify(menu).slice(0, 45000)}`,
    `Mensagem atual do cliente: ${params.message}`
  ].join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const parsed = safeJsonParse(String(payload?.choices?.[0]?.message?.content || ''));
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

function buildOrderSummary(draft: any) {
  const items = Array.isArray(draft?.items) ? draft.items : [];
  const lines = items.map((item: any, index: number) => {
    const options = Array.isArray(item.options) && item.options.length
      ? `\n   ${item.options.map((option: any) => `- ${option.group ? `${option.group}: ` : ''}${option.name}${Number(option.price || 0) > 0 ? ` (+${formatBRL(option.price)})` : ''}`).join('\n   ')}`
      : '';
    return `${index + 1}. ${item.quantity}x ${item.product_name} - ${formatBRL(item.total)}${options}`;
  });
  const deliveryFee = Number(draft?.delivery_fee || 0);
  const total = Number(draft?.total || 0) + deliveryFee;
  return [
    'Anotei seu pedido:',
    lines.join('\n') || '- Nenhum item',
    deliveryFee > 0 ? `Taxa de entrega: ${formatBRL(deliveryFee)}` : '',
    `Total: ${formatBRL(total)}`
  ].filter(Boolean).join('\n');
}

async function loadOrderDraft(supabase: any, conversationId: string) {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('id, content')
    .eq('conversation_id', conversationId)
    .eq('sender', 'bot')
    .eq('message_type', 'order_draft')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  try {
    return data?.content ? JSON.parse(String(data.content)) : null;
  } catch {
    return null;
  }
}

async function saveOrderDraft(supabase: any, conversationId: string, draft: any) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: JSON.stringify({ ...draft, updated_at: new Date().toISOString() }),
    sender: 'bot',
    message_type: 'order_draft',
    delivered: false
  });
}

async function clearOrderDraft(supabase: any, conversationId: string) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: JSON.stringify({ cleared: true, updated_at: new Date().toISOString() }),
    sender: 'bot',
    message_type: 'order_draft',
    delivered: false
  });
}

async function loadMenuForOrdering(supabase: any, restaurantId: string) {
  const { data: products } = await supabase
    .from('products')
    .select('id,name,description,price,category,category_id,available,show_in_delivery,available_delivery,image_url,send_to_kds')
    .eq('user_id', restaurantId)
    .eq('available', true)
    .order('category', { ascending: true })
    .limit(300);

  const productRows = Array.isArray(products) ? products : [];
  const ids = productRows.map((product: any) => String(product.id)).filter(Boolean);
  if (ids.length === 0) return { products: [], variationsByProduct: new Map() };

  const variationsByProduct = new Map<string, any[]>();
  const addVariation = (productId: string, variation: any) => {
    if (!productId || !variation) return;
    const arr = variationsByProduct.get(productId) || [];
    arr.push({
      ...variation,
      options: parseVariationOptions(variation?.options).filter((option: any) => option?.active !== false)
    });
    variationsByProduct.set(productId, arr);
  };

  const { data: localVariations } = await supabase
    .from('product_variations')
    .select('product_id,id,name,required,max_selections,options,price')
    .in('product_id', ids);
  for (const variation of localVariations || []) addVariation(String(variation.product_id), variation);

  try {
    const { data: links } = await supabase
      .from('product_global_variation_links')
      .select('product_id,global_variation_id,required,min_selections,max_selections,pricing_mode,fixed_option_price,price_multiplier,option_price_overrides')
      .in('product_id', ids);
    const globalIds = Array.from(new Set((links || []).map((link: any) => String(link.global_variation_id)).filter(Boolean)));
    if (globalIds.length) {
      const { data: globals } = await supabase
        .from('global_variations')
        .select('id,name,required,max_selections,options,active')
        .in('id', globalIds);
      const byId = new Map<string, any>((globals || []).map((item: any) => [String(item.id), item]));
      for (const link of links || []) {
        const global = byId.get(String(link.global_variation_id));
        if (!global || global.active === false) continue;
        addVariation(String(link.product_id), {
          ...global,
          required: link.required !== null && link.required !== undefined ? Boolean(link.required) : Boolean(global.required),
          max_selections: link.max_selections ?? global.max_selections,
          pricing_mode: link.pricing_mode,
          fixed_option_price: link.fixed_option_price,
          price_multiplier: link.price_multiplier,
          option_price_overrides: link.option_price_overrides
        });
      }
    }
  } catch {
    // Global variations are optional in old installs.
  }

  return { products: productRows, variationsByProduct };
}

function applyMentionedOptions(text: string, product: any, variationsByProduct: Map<string, any[]>) {
  const normalizedText = normalizeForMatch(text);
  const variations = variationsByProduct.get(String(product?.id)) || [];
  const selected: any[] = [];
  const missing: any[] = [];

  for (const variation of variations) {
    const max = Math.max(1, Number(variation?.max_selections || 1));
    const options = parseVariationOptions(variation?.options);
    const matched = options.filter((option: any) => {
      return optionMatchesText(option?.name, normalizedText);
    }).slice(0, max);

    if (matched.length) {
      for (const option of matched) {
        selected.push({
          group: String(variation?.name || ''),
          name: String(option?.name || ''),
          price: optionPrice(option)
        });
      }
    } else if (variation?.required) {
      missing.push({ variation, options });
    }
  }

  return { selected, missing };
}

function applyRequestedOptions(requestedOptions: any[], product: any, variationsByProduct: Map<string, any[]>) {
  const optionText = (requestedOptions || [])
    .map((option: any) => typeof option === 'string' ? option : `${option?.group || ''} ${option?.name || option?.value || ''}`)
    .join(' ');
  const result = applyMentionedOptions(optionText, product, variationsByProduct);
  const availableOptions = (variationsByProduct.get(String(product?.id)) || [])
    .flatMap((variation: any) => parseVariationOptions(variation?.options).map((option: any) => ({
      group: String(variation?.name || ''),
      name: String(option?.name || ''),
      price: optionPrice(option)
    })))
    .filter((option: any) => option.name);
  const invalid = (requestedOptions || [])
    .map((option: any) => typeof option === 'string' ? option : String(option?.name || option?.value || ''))
    .map((option: string) => option.trim())
    .filter(Boolean)
    .filter((requested: string) => !availableOptions.some((option: any) => optionMatchesText(option.name, requested)));
  return { ...result, invalid, availableOptions };
}

function mergeSelectedOptions(currentOptions: any[], selectedOptions: any[]) {
  const bucket = new Map<string, any>();
  for (const option of [...(currentOptions || []), ...(selectedOptions || [])]) {
    const key = `${normalizeForMatch(option?.group)}:${normalizeForMatch(option?.name)}`;
    if (!key.replace(':', '')) continue;
    bucket.set(key, option);
  }
  return Array.from(bucket.values());
}

function applyAdditionalOptionsToLastDraftItem(draft: any, text: string, products: any[], variationsByProduct: Map<string, any[]>) {
  const items = Array.isArray(draft?.items) ? [...draft.items] : [];
  if (!items.length) return { draft, updated: false };
  const lastIndex = items.length - 1;
  const lastItem = items[lastIndex];
  const product = products.find((item: any) => String(item.id) === String(lastItem?.product_id));
  if (!product) return { draft, updated: false };
  const result = applyMentionedOptions(text, product, variationsByProduct);
  if (!result.selected.length) return { draft, updated: false };
  items[lastIndex] = {
    ...lastItem,
    options: mergeSelectedOptions(Array.isArray(lastItem.options) ? lastItem.options : [], result.selected)
  };
  return {
    draft: recalculateDraft({ ...draft, items }),
    updated: true,
    product,
    selected: result.selected
  };
}

function buildProductComplementsReply(product: any, variationsByProduct: Map<string, any[]>) {
  const variations = variationsByProduct.get(String(product?.id)) || [];
  if (!variations.length) {
    return `Para ${String(product?.name || 'esse produto')}, não encontrei complementos cadastrados. Posso seguir com o item simples ou te mostrar outras opções.`;
  }

  const lines = variations.map((variation: any) => {
    const options = parseVariationOptions(variation?.options)
      .filter((option: any) => option?.active !== false)
      .slice(0, 18)
      .map((option: any) => `${String(option?.name || '').trim()}${optionPrice(option) > 0 ? ` (+${formatBRL(optionPrice(option))})` : ''}`)
      .filter(Boolean)
      .join(', ');
    const required = variation?.required ? 'obrigatório' : 'opcional';
    return `• ${variation.name} (${required}): ${options || 'sem opções ativas'}`;
  });

  return `Para ${product.name}, temos estes complementos:\n${lines.join('\n')}\n\nMe diga quais você quer que eu monto o pedido por aqui.`;
}

function mergeBrainDetailsIntoDraft(draft: any, brain: any) {
  const next = { ...draft };
  const name = String(brain?.customer_name || '').trim();
  if (name && !/^cliente whatsapp$/i.test(name)) next.customer_name = name;
  const orderType = String(brain?.order_type || '').trim().toLowerCase();
  if (orderType === 'delivery' || orderType === 'entrega') next.order_type = 'delivery';
  if (orderType === 'pickup' || orderType === 'retirada' || orderType === 'balcao' || orderType === 'balcão') next.order_type = 'pickup';
  const address = String(brain?.address || '').trim();
  if (address) next.customer_address = address;
  const payment = normalizeIntentText(String(brain?.payment_method || ''));
  if (payment === 'pix') next.payment_method = 'pix';
  if (payment.includes('dinheiro')) next.payment_method = 'dinheiro';
  if (payment.includes('cartao') || payment.includes('cartão') || payment.includes('credito') || payment.includes('debito')) next.payment_method = 'cartao';
  return next;
}

function recalculateDraft(draft: any) {
  const items = (Array.isArray(draft?.items) ? draft.items : []).map((item: any) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const optionsTotal = (Array.isArray(item.options) ? item.options : []).reduce((total: number, option: any) => total + Number(option?.price || 0), 0);
    const unit = Number(item.price || 0) + optionsTotal;
    return { ...item, quantity, unit_total: unit, total: unit * quantity };
  });
  return {
    ...draft,
    items,
    total: items.reduce((total: number, item: any) => total + Number(item.total || 0), 0)
  };
}

function readCustomerFieldsFromText(text: string, draft: any) {
  const normalized = normalizeIntentText(text);
  const next = { ...draft };
  if (/\b(entrega|delivery|entregar)\b/.test(normalized)) next.order_type = 'delivery';
  if (/\b(retirada|retirar|buscar|balcao|balcão)\b/.test(normalized)) next.order_type = 'pickup';
  if (/\bpix\b/.test(normalized)) next.payment_method = 'pix';
  if (/\b(dinheiro|especie|espécie)\b/.test(normalized)) next.payment_method = 'dinheiro';
  if (/\b(cartao|cartão|credito|crédito|debito|débito)\b/.test(normalized)) next.payment_method = 'cartao';

  const addressMatch = String(text || '').match(/(?:endereco|endereço|rua|av\.?|avenida|travessa|tv\.?)[:\s].{6,}/i);
  if (addressMatch) next.customer_address = addressMatch[0].replace(/^(endereco|endereço)\s*:?\s*/i, '').trim();
  if (next.order_type === 'delivery' && !next.customer_address && String(text || '').trim().length >= 8 && !/\b(pix|dinheiro|cartao|cartão|retirada|confirmo|confirmar)\b/i.test(text)) {
    next.customer_address = String(text || '').trim();
  }
  return next;
}

function getNextOrderQuestion(draft: any, customerName: string) {
  const items = Array.isArray(draft?.items) ? draft.items : [];
  if (items.length === 0) return 'Me diga o que você quer pedir. Ex: 1 açaí de 15 com granola e banana.';
  if (!draft.customer_name || /^cliente whatsapp$/i.test(String(draft.customer_name || '')) || /^cliente$/i.test(String(customerName || ''))) {
    return `${buildOrderSummary(draft)}\n\nQual é o nome para o pedido?`;
  }
  if (!draft.order_type) return `${buildOrderSummary(draft)}\n\nVai ser entrega ou retirada?`;
  if (draft.order_type === 'delivery' && !String(draft.customer_address || '').trim()) {
    return `${buildOrderSummary(draft)}\n\nMe envie o endereço de entrega, por favor.`;
  }
  if (!draft.payment_method) return `${buildOrderSummary(draft)}\n\nQual vai ser a forma de pagamento? PIX, dinheiro ou cartão?`;
  return `${buildOrderSummary(draft)}\n\nPosso confirmar esse pedido?`;
}

async function notifyOrderCreatedInternally(orderId: string) {
  const SUPABASE_URL = getEnv('SUPABASE_URL');
  const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', getEnv('SERVICE_ROLE_KEY'));
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !orderId) return;
  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-order-created`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ orderId })
  }).catch(() => null);
}

async function createOrderFromDraft(supabase: any, restaurantId: string, customerPhone: string, draft: any) {
  const orderNumber = `WA-${new Date().toISOString().slice(2, 10).replace(/\D/g, '')}-${String(Date.now()).slice(-5)}`;
  const deliveryFee = Number(draft?.delivery_fee || 0);
  const total = Number(draft?.total || 0) + deliveryFee;
  const items = (Array.isArray(draft?.items) ? draft.items : []).map((item: any) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    price: Number(item.unit_total || item.price || 0),
    options: Array.isArray(item.options) ? item.options : [],
    variations: (Array.isArray(item.options) ? item.options : []).map((option: any) => `${option.group ? `${option.group}: ` : ''}${option.name}`),
    notes: item.notes || '',
    total: Number(item.total || 0)
  }));

  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: restaurantId,
      order_number: orderNumber,
      customer_name: String(draft?.customer_name || 'Cliente WhatsApp').trim(),
      customer_phone: customerPhone,
      customer_address: draft?.order_type === 'delivery' ? String(draft?.customer_address || '').trim() : null,
      order_type: draft?.order_type === 'pickup' ? 'pickup' : 'delivery',
      payment_method: String(draft?.payment_method || 'pix'),
      items,
      total,
      delivery_fee: deliveryFee || null,
      status: 'pending',
      acceptance_status: 'pending_acceptance',
      estimated_time: '30-45 min',
      variations: {
        source: 'WHATSAPP_AI',
        channel: 'whatsapp',
        customer_confirmed_at: new Date().toISOString(),
        draft
      }
    })
    .select('id, order_number')
    .single();

  if (error) throw error;
  await notifyOrderCreatedInternally(String(data?.id || ''));
  return data;
}

async function handleWhatsAppOrderFlow(params: {
  supabase: any;
  restaurantId: string;
  customerPhone: string;
  customerName: string;
  conversationId: string;
  text: string;
  restaurantName?: string;
  history?: any[];
}) {
  const { supabase, restaurantId, customerPhone, conversationId } = params;
  const text = String(params.text || '').trim();
  const existingDraft = await loadOrderDraft(supabase, conversationId);
  const draftActive = existingDraft && !existingDraft.cleared && Array.isArray(existingDraft.items);
  if (!draftActive && !wantsToOrder(text)) return null;

  if (isOrderCancel(text)) {
    await clearOrderDraft(supabase, conversationId);
    return { replyText: 'Pedido cancelado por aqui. Se quiser começar outro, é só me dizer o que deseja pedir.', strategy: 'order_cancelled' };
  }

  let draft = draftActive
    ? { ...existingDraft }
    : { items: [], customer_name: params.customerName, customer_phone: customerPhone, order_type: null, payment_method: null };

  draft = readCustomerFieldsFromText(text, draft);

  const { products, variationsByProduct } = await loadMenuForOrdering(supabase, restaurantId);
  const brain = await callOrderBrain({
    message: text,
    restaurantName: params.restaurantName || 'restaurante',
    customerName: params.customerName,
    draft,
    products,
    variationsByProduct,
    history: params.history || []
  }).catch(() => null);

  if (brain?.intent === 'human_handoff' || brain?.intent === 'other') {
    if (!draftActive && !wantsToOrder(text)) return null;
  }

  if (brain?.intent === 'cancel_order') {
    await clearOrderDraft(supabase, conversationId);
    return { replyText: 'Pedido cancelado por aqui. Quando quiser começar outro, é só me chamar.', strategy: 'ai_order_cancelled' };
  }

  draft = mergeBrainDetailsIntoDraft(draft, brain);
  const brainItems = Array.isArray(brain?.items) ? brain.items.filter((item: any) => String(item?.product || item?.name || '').trim()) : [];
  const itemsToProcess = brainItems.length > 0
    ? brainItems
    : (() => {
        const matched = findBestProduct(text, products);
        return matched ? [{ product: matched.name, quantity: parseQuantityFromText(text), target_price: parseMoneyFromText(text), options: [], raw_text: text, __matchedProduct: matched }] : [];
      })();

  let processedProduct = false;
  for (const requestedItem of itemsToProcess) {
    const matchedProduct = requestedItem.__matchedProduct || findBestProductByIntent(requestedItem, products);
    if (!matchedProduct) continue;
    processedProduct = true;
    const desiredPrice = parseMoneyFromText(text);
    const requestedPrice = Number(requestedItem?.target_price || desiredPrice || 0);
    if (requestedPrice > 0 && Math.abs(Number(matchedProduct.price || 0) - requestedPrice) > 0.01) {
      const productCategoryTokens = relevantTokens(String(matchedProduct.category || matchedProduct.name || ''));
      const alternatives = products
        .filter((product: any) => {
          const priceOk = Math.abs(Number(product.price || 0) - requestedPrice) <= 0.01;
          const categoryOk = productCategoryTokens.some((token) => normalizeForMatch(`${product.category} ${product.name}`).includes(token));
          return priceOk || categoryOk;
        })
        .slice(0, 8)
        .map((product: any) => `- ${product.name}: ${formatBRL(product.price)}`)
        .join('\n');
      return {
        replyText: `Entendi que você quer algo de ${formatBRL(requestedPrice)}, mas não encontrei esse valor exatamente para "${matchedProduct.name}".\n\nEscolha uma destas opções:\n${alternatives || `- ${matchedProduct.name}: ${formatBRL(matchedProduct.price)}`}`,
        strategy: 'ai_order_price_mismatch'
      };
    }
    const quantity = Math.max(1, Math.min(50, Number(requestedItem?.quantity || parseQuantityFromText(text)) || 1));
    const requestedOptions = Array.isArray(requestedItem?.options) ? requestedItem.options : [];
    const optionResult: any = requestedOptions.length > 0
      ? applyRequestedOptions(requestedOptions, matchedProduct, variationsByProduct)
      : applyMentionedOptions(text, matchedProduct, variationsByProduct);
    const { selected, missing, invalid, availableOptions } = optionResult;
    if (Array.isArray(invalid) && invalid.length > 0) {
      const alternatives = (availableOptions || [])
        .slice(0, 18)
        .map((option: any) => `- ${option.name}${option.price > 0 ? ` (+${formatBRL(option.price)})` : ''}`)
        .join('\n');
      return {
        replyText: `Não encontrei ${invalid.map((item: string) => `"${item}"`).join(', ')} para ${matchedProduct.name}.\n\nOpções disponíveis:\n${alternatives || 'Nenhum complemento ativo cadastrado.'}\n\nQual dessas opções você prefere?`,
        strategy: 'ai_order_invalid_option'
      };
    }
    if (missing.length > 0) {
      const first = missing[0];
      const optionList = first.options.slice(0, 12).map((option: any) => `- ${String(option?.name || '').trim()}${optionPrice(option) > 0 ? ` (+${formatBRL(optionPrice(option))})` : ''}`).join('\n');
      draft.pending_product = {
        product_id: matchedProduct.id,
        text: `${text} ${requestedOptions.join(' ')}`,
        requested_options: requestedOptions,
        quantity
      };
      await saveOrderDraft(supabase, conversationId, draft);
      return {
        replyText: `Esse item precisa de uma escolha em "${first.variation.name}".\n${optionList}\n\nQual opção você prefere?`,
        strategy: 'ai_order_missing_required_option'
      };
    }

    draft.items = [
      ...(Array.isArray(draft.items) ? draft.items : []),
      {
        product_id: matchedProduct.id,
        product_name: matchedProduct.name,
        quantity,
        price: Number(matchedProduct.price || 0),
        options: selected,
        notes: String(requestedItem?.notes || '')
      }
    ];
    draft.pending_product = null;
  }

  if (itemsToProcess.length === 0 && draft.pending_product) {
    const pendingProduct = products.find((product: any) => String(product.id) === String(draft.pending_product.product_id));
    if (pendingProduct) {
      const pendingOptionsFromBrain = brainItems.flatMap((item: any) => Array.isArray(item?.options) ? item.options : []);
      const pendingOptions = [
        ...(Array.isArray(draft.pending_product.requested_options) ? draft.pending_product.requested_options : []),
        ...pendingOptionsFromBrain
      ];
      const { selected, missing } = pendingOptions.length > 0
        ? applyRequestedOptions([...pendingOptions, text], pendingProduct, variationsByProduct)
        : applyMentionedOptions(`${draft.pending_product.text} ${text}`, pendingProduct, variationsByProduct);
      if (missing.length === 0) {
        draft.items = [
          ...(Array.isArray(draft.items) ? draft.items : []),
          {
            product_id: pendingProduct.id,
            product_name: pendingProduct.name,
            quantity: Number(draft.pending_product.quantity || 1),
            price: Number(pendingProduct.price || 0),
            options: selected,
            notes: ''
          }
        ];
        draft.pending_product = null;
      }
    }
  }

  let updatedExistingItem = false;
  if (!processedProduct && !draft.pending_product && Array.isArray(draft.items) && draft.items.length > 0 && /(^|\b)com\b|granola|leite|banana|adicional|complemento/i.test(text)) {
    const result = applyAdditionalOptionsToLastDraftItem(draft, text, products, variationsByProduct);
    if (result.updated) {
      draft = result.draft;
      updatedExistingItem = true;
    }
  }

  const itemsNow = Array.isArray(draft.items) ? draft.items : [];
  const maybeOnlyName = /^[A-Za-zÀ-ÿ' ]{2,60}$/.test(text) && !processedProduct && !/\b(entrega|retirada|pix|dinheiro|cart[aã]o|rua|avenida|av\.?)\b/i.test(text);
  if (itemsNow.length > 0 && maybeOnlyName && !updatedExistingItem && (!draft.customer_name || /^cliente whatsapp$/i.test(String(draft.customer_name || '')))) {
    draft.customer_name = text.trim();
  }

  draft = recalculateDraft(draft);
  const nextQuestion = getNextOrderQuestion(draft, params.customerName);
  const ready = !/Qual é o nome|Vai ser entrega|endereço|forma de pagamento|Me diga o que/i.test(nextQuestion);

  if (ready && (isOrderConfirmation(text) || brain?.intent === 'confirm_order')) {
    const order = await createOrderFromDraft(supabase, restaurantId, customerPhone, draft);
    await clearOrderDraft(supabase, conversationId);
    return {
      replyText: `Pedido confirmado! ✅\nNúmero do pedido: #${order?.order_number || ''}\nO restaurante já recebeu no sistema e vai acompanhar por lá.`,
      strategy: 'order_created'
    };
  }

  if (!processedProduct && !draft.pending_product && !draftActive && wantsToOrder(text)) {
    if (!hasProductClue(text)) {
      const examples = products.slice(0, 5).map((product: any) => `- ${product.name}: ${formatBRL(product.price)}`).join('\n');
      return {
        replyText: `Pode sim, faço seu pedido por aqui. Me diga o item, tamanho/valor e complementos.\n\nExemplo: "1 açaí de 15 com granola e leite condensado".${examples ? `\n\nAlgumas opções:\n${examples}` : ''}`,
        strategy: 'order_start_ask_item'
      };
    }
    const suggestions = products.slice(0, 8).map((product: any) => `- ${product.name}: ${formatBRL(product.price)}`).join('\n');
    return {
      replyText: `Não consegui identificar exatamente o produto. Você pode escrever o nome como está no cardápio?\n\nAlgumas opções:\n${suggestions}\n\nCardápio completo: ${buildMenuShareUrl(restaurantId)}`,
      strategy: 'order_product_not_found'
    };
  }

  await saveOrderDraft(supabase, conversationId, draft);
  return { replyText: nextQuestion, strategy: ready ? 'order_confirmation_pending' : 'order_collecting_data' };
}

function minutesSince(dateString?: string | null) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60000;
}

function buildTemporaryPauseStatus(minutes = 60) {
  return `bot_paused_until:${new Date(Date.now() + minutes * 60000).toISOString()}`;
}

function getPauseState(status: unknown) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'bot_paused') return { paused: true, expired: false, reason: 'manual' };
  if (!value.startsWith('bot_paused_until:')) return { paused: false, expired: false, reason: '' };

  const rawDate = value.slice('bot_paused_until:'.length);
  const until = new Date(rawDate).getTime();
  if (!Number.isFinite(until)) return { paused: false, expired: true, reason: 'invalid_until' };

  return {
    paused: until > Date.now(),
    expired: until <= Date.now(),
    reason: 'temporary',
    until: new Date(until).toISOString()
  };
}

function isActionableCustomerIntent(text: string) {
  return wantsOpeningHours(text) ||
    wantsMenuLink(text) ||
    wantsOrderTracking(text) ||
    wantsPromotions(text) ||
    wantsComplementsInfo(text) ||
    wantsToOrder(text) ||
    isGreeting(text);
}

export async function pauseRestaurantBotForConversation(params: {
  supabase: any;
  restaurantId: string;
  customerPhone: string;
  customerName?: string;
  reason?: string;
}) {
  const supabase = params.supabase;
  const restaurantId = String(params.restaurantId || '').trim();
  const customerPhone = normalizePhone(params.customerPhone);
  const customerName = String(params.customerName || 'Cliente WhatsApp').trim() || 'Cliente WhatsApp';

  if (!restaurantId || !customerPhone) {
    return { ok: false, skipped: true, reason: 'missing_input' };
  }

  const { data: existingConversation, error: findError } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };

  let conversationId = String(existingConversation?.id || '');
  if (!conversationId) {
    const { data: createdConversation, error: createError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: buildTemporaryPauseStatus(60)
      })
      .select('id')
      .single();

    if (createError) return { ok: false, error: createError.message };
    conversationId = String(createdConversation?.id || '');
  }

  const fullPausePayload = {
    status: buildTemporaryPauseStatus(60),
    bot_paused: true,
    bot_paused_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let { error: updateError } = await supabase
    .from('whatsapp_conversations')
    .update(fullPausePayload)
    .eq('id', conversationId)
    .eq('user_id', restaurantId);

  if (updateError && String(updateError.message || '').includes('bot_paused')) {
    const fallbackResult = await supabase
      .from('whatsapp_conversations')
      .update({
        status: buildTemporaryPauseStatus(60),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', restaurantId);
    updateError = fallbackResult.error;
  }

  if (updateError) return { ok: false, error: updateError.message };

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_paused_by_outgoing', 'Bot pausado por mensagem enviada pelo restaurante', {
    customerPhone,
    conversationId,
    reason: params.reason || 'outgoing_message'
  });

  return { ok: true, conversationId };
}

export async function logWhatsAppBotStep(supabase: any, restaurantId: string, actionType: string, description: string, metadata: Record<string, unknown> = {}) {
  const userId = String(restaurantId || '').trim();
  if (!supabase || !userId) return;
  await supabase.from('agent_activity_logs').insert({
    user_id: userId,
    action_type: actionType,
    description,
    metadata: {
      channel: 'whatsapp_bot',
      ...metadata
    }
  });
}

async function callOpenAiBot(payload: {
  supabase?: any;
  message: string;
  restaurantId: string;
  customerPhone: string;
  instance: string;
  media?: any;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const SUPABASE_URL = getEnv('SUPABASE_URL');
  const BORACUME_INTERNAL_KEY = getEnv('BORACUME_INTERNAL_KEY', getEnv('BOT_WEBHOOK_SECRET'));
  if (!SUPABASE_URL || !BORACUME_INTERNAL_KEY) {
    await logWhatsAppBotStep(payload.supabase, payload.restaurantId, 'whatsapp_bot_openai_env_missing', 'OpenAI bot sem ambiente interno configurado', {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasInternalKey: Boolean(BORACUME_INTERNAL_KEY)
    });
    return '';
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/evolution-bot-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-boracume-key': BORACUME_INTERNAL_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  await logWhatsAppBotStep(payload.supabase, payload.restaurantId, response.ok ? 'whatsapp_bot_openai_ok' : 'whatsapp_bot_openai_error', response.ok ? 'OpenAI respondeu para o bot' : 'OpenAI não respondeu com sucesso para o bot', {
    status: response.status,
    instance: payload.instance,
    customerPhone: payload.customerPhone,
    hasMessage: Boolean(String(data?.message || '').trim()),
    error: String(data?.error || data?.details || '')
  });
  const message = String(data?.message || '').trim();
  if (/^teste ok\b/i.test(message)) return '';
  return message;
}

async function sendEvolutionTypingPresence(instance: string, number: string, seconds = 2) {
  const EVOLUTION_BASE_URL = getEnv('EVOLUTION_BASE_URL');
  const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY');
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !instance || !number) return;

  const base = EVOLUTION_BASE_URL.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    apikey: EVOLUTION_API_KEY
  };
  const payloads = [
    {
      url: `${base}/chat/sendPresence/${encodeURIComponent(instance)}`,
      body: { number, presence: 'composing', delay: seconds * 1000 }
    },
    {
      url: `${base}/message/sendPresence/${encodeURIComponent(instance)}`,
      body: { number, presence: 'composing', delay: seconds * 1000 }
    }
  ];

  for (const payload of payloads) {
    const response = await fetch(payload.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload.body)
    }).catch(() => null);
    if (response?.ok) return;
  }
}

export async function sendEvolutionText(restaurantId: string, instanceName: string, phone: string, text: string) {
  const EVOLUTION_BASE_URL = getEnv('EVOLUTION_BASE_URL');
  const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY');
  const fallbackRestaurantId = String(restaurantId || '').trim();
  const instance = String(instanceName || '').trim();
  const number = normalizePhone(phone);
  const message = String(text || '').trim();
  let primaryFailure: any = null;

  if (!number || !message) {
    return { ok: false, skipped: true };
  }

  if (EVOLUTION_BASE_URL && EVOLUTION_API_KEY && instance) {
    await sendEvolutionTypingPresence(instance, number, Math.min(5, Math.max(1, Math.ceil(message.length / 80)))).catch(() => null);
    const response = await fetch(`${EVOLUTION_BASE_URL.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number,
        text: message,
        delay: 1200,
        linkPreview: true,
        options: {
          delay: 1200,
          presence: 'composing'
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return { ok: true, status: response.status, data, transport: 'evolution-sendText' };
    }
    primaryFailure = { ok: false, status: response.status, data, transport: 'evolution-sendText' };
  }

  if (!fallbackRestaurantId) {
    return primaryFailure || { ok: false, error: 'missing_restaurant_id' };
  }

  const legacy = await sendRestaurantWhatsApp(fallbackRestaurantId, number, message);
  if (legacy?.ok) {
    return { ...legacy, transport: 'legacy-send-text', fallbackFrom: primaryFailure?.transport || null };
  }

  return {
    ...legacy,
    transport: 'legacy-send-text',
    primaryFailure
  };
}

async function transcribeIncomingAudio(media: any) {
  if (!media || String(media?.type || '') !== 'audio') return '';
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) return '';

  const mimeType = String(media?.mimeType || 'audio/ogg');
  let blob: Blob | null = null;
  const base64 = String(media?.base64 || '').trim();
  const url = String(media?.url || '').trim();

  if (base64) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    blob = new Blob([bytes], { type: mimeType });
  } else if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url).catch(() => null);
    if (response?.ok) blob = await response.blob();
  }

  if (!blob) return '';

  const extension = mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'ogg';
  const form = new FormData();
  form.append('model', getEnv('OPENAI_TRANSCRIPTION_MODEL', 'gpt-4o-mini-transcribe'));
  form.append('language', 'pt');
  form.append('file', blob, `audio.${extension}`);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  }).catch(() => null);
  if (!response?.ok) return '';
  const data = await response.json().catch(() => ({}));
  return String(data?.text || '').trim();
}

export async function processRestaurantBotMessage(params: {
  supabase: any;
  restaurantId: string;
  instanceName: string;
  customerPhone: string;
  text: string;
  media?: any;
}) {
  const supabase = params.supabase;
  const restaurantId = String(params.restaurantId || '').trim();
  const customerPhone = normalizePhone(params.customerPhone);
  const media = params.media || null;
  let text = String(params.text || '').trim();
  if (media?.type === 'audio') {
    const transcription = await transcribeIncomingAudio(media).catch(() => '');
    if (transcription) text = transcription;
  }
  const instanceName = String(params.instanceName || '').trim();

  if (!restaurantId || !customerPhone || !text) {
    return { ok: false, skipped: true, reason: 'missing_input' };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_received', 'Mensagem recebida para processamento do bot', {
    instanceName,
    customerPhone,
    textPreview: text.slice(0, 120)
  });

  const phoneCandidates = buildPhoneCandidates(customerPhone);
  const [existingCustomerResult, context] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, updated_at')
      .eq('user_id', restaurantId)
      .in('phone', phoneCandidates)
      .maybeSingle(),
    loadRestaurantContext(supabase, restaurantId)
  ]);

  const existingCustomer = existingCustomerResult?.data;

  const customerName = String(existingCustomer?.name || 'Cliente WhatsApp');

  if (!existingCustomer) {
    await supabase.from('customers').insert({
      user_id: restaurantId,
      name: customerName,
      phone: customerPhone
    });
  }

  const { data: existingConversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, status, bot_paused_at, bot_paused_by')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  let conversationId = String(existingConversation?.id || '');
  if (!conversationId) {
    const { data: createdConversation, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: 'open'
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    conversationId = String(createdConversation?.id || '');
  }

  const recentDuplicateCutoff = new Date(Date.now() - 30 * 1000).toISOString();
  const { data: recentDuplicateMessage } = await supabase
    .from('whatsapp_messages')
    .select('id, sent_at')
    .eq('conversation_id', conversationId)
    .eq('sender', 'customer')
    .eq('content', text)
    .gte('sent_at', recentDuplicateCutoff)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentDuplicateMessage?.id) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_duplicate_silent', 'Mensagem duplicada recebida por outro webhook; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      duplicateMessageId: recentDuplicateMessage.id,
      textPreview: text.slice(0, 120)
    });
    return { ok: true, skipped: true, reason: 'duplicate_recent_message', conversationId };
  }

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: text,
    sender: 'customer',
    message_type: 'text',
    delivered: true
  });

  if (isMarketingOptOut(text)) {
    await supabase
      .from('whatsapp_marketing_optouts')
      .upsert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        reason: 'customer_message'
      }, { onConflict: 'user_id,customer_phone' });

    await supabase
      .from('whatsapp_marketing_recipients')
      .update({
        status: 'opted_out',
        last_error: 'Cliente solicitou sair das ofertas.'
      })
      .eq('user_id', restaurantId)
      .eq('customer_phone', customerPhone)
      .eq('status', 'queued');

    const optOutReply = `Pronto. Não vou enviar novas ofertas por aqui. Se precisar falar com o ${context.restaurantName}, é só mandar mensagem.`;
    const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, optOutReply);
    if (sendResult?.ok) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: optOutReply,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });
    }

    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_marketing_optout', 'Cliente saiu das ofertas automáticas', {
      instanceName,
      customerPhone,
      conversationId,
      sendOk: Boolean(sendResult?.ok)
    });

    return { ok: true, skipped: true, reason: 'marketing_optout', conversationId };
  }

  const pauseState = getPauseState(existingConversation?.status);
  const shouldResumeExpiredPause = pauseState.expired;
  const shouldResumeTemporaryPauseForCustomer =
    pauseState.paused &&
    pauseState.reason === 'temporary' &&
    minutesSince(existingConversation?.bot_paused_at) >= 10 &&
    isActionableCustomerIntent(text);

  if (shouldResumeExpiredPause || shouldResumeTemporaryPauseForCustomer) {
    const resumePayload = {
      status: 'active',
      bot_paused: false,
      bot_paused_at: null,
      bot_paused_by: null,
      updated_at: new Date().toISOString()
    };

    const resumeResult = await supabase
      .from('whatsapp_conversations')
      .update(resumePayload)
      .eq('id', conversationId);

    if (resumeResult.error && String(resumeResult.error.message || '').includes('bot_paused')) {
      await supabase
        .from('whatsapp_conversations')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    if (shouldResumeTemporaryPauseForCustomer) {
      await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_auto_resumed', 'Bot reativado automaticamente por nova intenção do cliente', {
        instanceName,
        customerPhone,
        conversationId,
        pauseState,
        textPreview: text.slice(0, 120)
      });
    }
  }

  if (pauseState.paused && !shouldResumeTemporaryPauseForCustomer) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_paused', 'Bot pausado por atendimento humano', {
      instanceName,
      customerPhone,
      conversationId,
      pauseState
    });
    return { ok: true, skipped: true, reason: 'bot_paused', conversationId };
  }

  const menuLinkNeedle = `/share/menu/${restaurantId}`;

  const [{ data: history }, { data: lastOrder }, { data: lastBotMessage }, { data: lastMenuMessage }, { data: productsData }] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('sender, content, sent_at')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(20),
    supabase
      .from('orders')
      .select('id, order_number, status, created_at')
      .eq('user_id', restaurantId)
      .in('customer_phone', phoneCandidates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('whatsapp_messages')
      .select('id, content, sent_at')
      .eq('conversation_id', conversationId)
      .eq('sender', 'bot')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('whatsapp_messages')
      .select('id, sent_at')
      .eq('conversation_id', conversationId)
      .eq('sender', 'bot')
      .ilike('content', `%${menuLinkNeedle}%`)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('products')
      .select('name, price, original_price, discount_percentage, is_highlight, available')
      .eq('user_id', restaurantId)
      .eq('available', true)
      .order('updated_at', { ascending: false })
      .limit(80)
  ]);

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('opening_hours')
    .eq('id', restaurantId)
    .maybeSingle();

  const explicitMenuIntent = wantsMenuLink(text);
  const greetingIntent = isGreeting(text);
  const thanksIntent = isThanks(text);
  const trackIntent = wantsOrderTracking(text);
  const openingHoursIntent = wantsOpeningHours(text);
  const promotionsIntent = wantsPromotions(text);
  const complementsInfoIntent = wantsComplementsInfo(text);
  const productMatches = findMentionedProducts(text, Array.isArray(productsData) ? productsData : []);
  const productInfoIntent = wantsProductInfo(text) && productMatches.length > 0;
  const lowSignalIntent = isLowSignalMessage(text) || thanksIntent;
  const humanIntent = wantsHumanAttendance(text);
  const problemIntent = isComplaintOrProblem(text);
  const customerMessageCount = (history || []).filter((item: any) => item?.sender === 'customer').length;
  const isFirstConversationTouch = customerMessageCount <= 1 && !lastBotMessage?.id;
  const recentBotReplyMinutes = minutesSince(lastBotMessage?.sent_at);
  const menuWasSentToday = Boolean(lastMenuMessage?.id && isSameLocalDay(lastMenuMessage?.sent_at));
  const canRepeatMenuReply = explicitMenuIntent
    ? recentBotReplyMinutes > 2
    : (!menuWasSentToday && (isFirstConversationTouch || greetingIntent || recentBotReplyMinutes > 20));
  const menuLink = buildMenuShareUrl(restaurantId);

  if (complementsInfoIntent && !wantsToOrder(text)) {
    const { products, variationsByProduct } = await loadMenuForOrdering(supabase, restaurantId);
    const product = findBestProduct(text, products);
    if (product) {
      const replyText = buildProductComplementsReply(product, variationsByProduct);
      const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, replyText);
      if (!sendResult?.ok) return { ok: false, error: 'send_failed', details: sendResult };
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: replyText,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });
      return { ok: true, replyText, conversationId, strategy: 'complements_info' };
    }
  }

  try {
    const orderFlow = await handleWhatsAppOrderFlow({
      supabase,
      restaurantId,
      customerPhone,
      customerName,
      conversationId,
      text,
      restaurantName: context.restaurantName,
      history: history || []
    });
    if (orderFlow?.replyText) {
      await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_order_flow_reply', 'Fluxo de pedido por WhatsApp respondeu', {
        instanceName,
        customerPhone,
        conversationId,
        strategy: orderFlow.strategy,
        replyPreview: String(orderFlow.replyText).slice(0, 160)
      });

      const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, orderFlow.replyText);
      if (!sendResult?.ok) {
        return { ok: false, error: 'send_failed', details: sendResult };
      }

      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: orderFlow.replyText,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });

      return { ok: true, replyText: orderFlow.replyText, conversationId, strategy: orderFlow.strategy };
    }
  } catch (error: any) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_order_flow_error', 'Fluxo de pedido por WhatsApp falhou', {
      instanceName,
      customerPhone,
      conversationId,
      error: String(error?.message || error || 'unknown_error')
    });
  }

  if (lowSignalIntent && !explicitMenuIntent && !trackIntent && !openingHoursIntent && !promotionsIntent && !humanIntent && !problemIntent) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_low_signal_silent', 'Mensagem curta/agradecimento; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      textPreview: text.slice(0, 120)
    });
    return { ok: true, skipped: true, reason: 'low_signal', conversationId };
  }

  if (humanIntent || problemIntent) {
    const pauseUntil = new Date(Date.now() + 60 * 60000).toISOString();
    const pausePayload = {
      status: `bot_paused_until:${pauseUntil}`,
      bot_paused: true,
      bot_paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const pauseUpdate = await supabase
      .from('whatsapp_conversations')
      .update(pausePayload)
      .eq('id', conversationId);

    if (pauseUpdate.error && String(pauseUpdate.error.message || '').includes('bot_paused')) {
      await supabase
        .from('whatsapp_conversations')
        .update({ status: `bot_paused_until:${pauseUntil}`, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    const handoffText = problemIntent
      ? `Entendi. Vou deixar um atendente do ${context.restaurantName} assumir por aqui para te ajudar melhor.`
      : `Claro. Vou chamar um atendente do ${context.restaurantName} para continuar por aqui.`;

    const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, handoffText);
    if (sendResult?.ok) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: handoffText,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });
    }

    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_handoff_paused', 'Bot pausado por pedido de atendente ou problema', {
      instanceName,
      customerPhone,
      conversationId,
      humanIntent,
      problemIntent,
      pauseUntil,
      sendOk: Boolean(sendResult?.ok)
    });

    return { ok: true, skipped: false, reason: 'handoff_paused', replyText: handoffText, conversationId };
  }

  let replyText = '';
  let replyStrategy = 'fallback';
  const deterministicReplies: string[] = [];

  if (trackIntent && lastOrder?.id) {
    deterministicReplies.push(fillTemplate(
      `📦 ${context.restaurantName}: acompanhe seu pedido #{order_number} aqui: {track_link}`,
      {
        restaurant_name: context.restaurantName,
        order_number: String(lastOrder.order_number || ''),
        track_link: buildTrackShareUrl(String(lastOrder.id), restaurantId, String(lastOrder.order_number || '')),
        menu_link: buildMenuShareUrl(restaurantId),
        customer_name: customerName
      }
    ));
    replyStrategy = openingHoursIntent ? 'multi_intent_tracking_hours' : 'order_tracking';
  } else if (trackIntent) {
    deterministicReplies.push(`📦 Não encontrei um pedido recente para este número no ${context.restaurantName}. Se quiser, me envie o nome usado no pedido ou peça o cardápio: ${buildMenuShareUrl(restaurantId)}`);
    replyStrategy = openingHoursIntent ? 'multi_intent_tracking_not_found_hours' : 'order_tracking_not_found';
  } else if (lastOrder?.id && /(status|situa[cç][aã]o|andamento).*(pedido)|pedido.*(status|situa[cç][aã]o|andamento)/i.test(text)) {
    deterministicReplies.push(`📦 Seu pedido #${String(lastOrder.order_number || '')} está ${buildOrderStatusLabel(String(lastOrder.status || ''))}. Acompanhe aqui: ${buildTrackShareUrl(String(lastOrder.id), restaurantId, String(lastOrder.order_number || ''))}`);
    replyStrategy = openingHoursIntent ? 'multi_intent_order_status_hours' : 'order_status_summary';
  }

  if (openingHoursIntent) {
    const openingHours = String(profileRow?.opening_hours || '').trim();
    deterministicReplies.push(buildOpeningHoursReply(context.restaurantName, openingHours, restaurantId));
    if (!trackIntent && replyStrategy === 'fallback') {
      replyStrategy = 'opening_hours';
    } else if (replyStrategy !== 'fallback' && replyStrategy !== 'opening_hours') {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if (promotionsIntent) {
    deterministicReplies.push(buildPromotionsReply(context.restaurantName, restaurantId, Array.isArray(productsData) ? productsData : []));
    if (replyStrategy === 'fallback') {
      replyStrategy = 'promotions';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if (productInfoIntent) {
    deterministicReplies.push(buildProductInfoReply(restaurantId, productMatches));
    if (replyStrategy === 'fallback') {
      replyStrategy = 'product_info';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if (greetingIntent && deterministicReplies.length === 0 && !explicitMenuIntent) {
    deterministicReplies.push(`Olá! Como posso te ajudar hoje?\n\nPosso te mandar o cardápio, montar um pedido por aqui ou consultar o status de um pedido.`);
    replyStrategy = 'greeting_help';
  }

  if (explicitMenuIntent && canRepeatMenuReply) {
    const menuTemplate = explicitMenuIntent ? (context.autoResponses.menu_link || '') : (context.autoResponses.welcome || '');
    const renderedMenuReply = fillTemplate(menuTemplate, {
      restaurant_name: context.restaurantName,
      menu_link: menuLink,
      customer_name: customerName,
      order_number: '',
      track_link: ''
    });

    deterministicReplies.push(
      ensureMenuLink(
        renderedMenuReply || (explicitMenuIntent
          ? `📋 Confira nosso cardápio: ${menuLink}`
          : `Olá! 👋 Bem-vindo ao ${context.restaurantName}. Aqui está nosso cardápio: ${menuLink}`),
        menuLink
      )
    );
    if (replyStrategy === 'fallback') {
      replyStrategy = 'menu_auto_reply';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  } else if (explicitMenuIntent && !canRepeatMenuReply && deterministicReplies.length === 0) {
    deterministicReplies.push(`Acabei de te mandar o cardápio acima. Se quiser, também posso montar seu pedido por aqui.`);
    replyStrategy = 'menu_repeat_guidance';
  }

  if (deterministicReplies.length > 0) {
    replyText = Array.from(new Set(deterministicReplies.filter(Boolean))).join('\n\n');
  } else if (!explicitMenuIntent && greetingIntent && menuWasSentToday) {
    replyText = `Olá! Como posso te ajudar agora?\n\nPosso montar um pedido por aqui, tirar dúvidas do cardápio ou consultar o status de um pedido.`;
    replyStrategy = 'greeting_after_menu_help';
  } else {
    replyStrategy = 'openai';
    try {
      replyText = await callOpenAiBot({
        supabase,
        message: text,
        restaurantId,
        customerPhone,
        instance: instanceName,
        media,
        conversationHistory: (history || [])
          .map((item: any) => ({
            role: item?.sender === 'customer' ? 'user' : 'assistant',
            content: toTextFromHistoryItem(item)
          }))
          .filter((item: any) => item.content)
      });
    } catch (error: any) {
      await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_openai_exception', 'Falha ao consultar resposta aberta do bot', {
        instanceName,
        customerPhone,
        error: String(error?.message || error || 'unknown_error')
      });
      replyText = '';
    }
  }

  if (!replyText) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_no_reply_silent', 'Nenhuma intenção acionável; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      greetingIntent,
      explicitMenuIntent,
      trackIntent,
      openingHoursIntent,
      promotionsIntent
    });
    return { ok: true, skipped: true, reason: 'no_actionable_intent', conversationId };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_reply_built', 'Resposta do bot montada', {
    instanceName,
    customerPhone,
    replyStrategy,
    replyPreview: replyText.slice(0, 160),
    hasOrder: Boolean(lastOrder?.id),
    isFirstConversationTouch,
    greetingIntent,
    explicitMenuIntent,
    trackIntent
  });

  const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, replyText);
  if (!sendResult?.ok) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_send_error', 'Falha ao enviar resposta do bot no WhatsApp', {
      instanceName,
      customerPhone,
      transport: sendResult?.transport || 'unknown',
      status: sendResult?.status || null,
      details: sendResult?.data || sendResult?.error || null
    });
    return { ok: false, error: 'send_failed', details: sendResult };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_sent', 'Resposta do bot enviada no WhatsApp', {
    instanceName,
    customerPhone,
    transport: sendResult?.transport || 'unknown',
    status: sendResult?.status || null
  });

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: replyText,
    sender: 'bot',
    message_type: 'text',
    delivered: true
  });

  await supabase
    .from('customers')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', restaurantId)
    .in('phone', phoneCandidates);

  return { ok: true, replyText, conversationId };
}
