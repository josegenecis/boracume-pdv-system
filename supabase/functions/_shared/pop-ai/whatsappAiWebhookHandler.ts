import { processRestaurantBotMessage } from '../whatsapp-bot.ts';
import {
  getConversationHistory,
  getOrCreatePopAiCustomer,
  getOrCreatePopAiSettings,
  logPopAiAction,
  savePopAiMessage,
  syncLegacyConversationAiState,
  updatePopAiConversationStatus,
  upsertPopAiConversation
} from './aiConversationService.ts';
import { buildPopAiSystemPrompt, classifyAiStatusFromResult } from './aiToolService.ts';
import { getRestaurantKnowledge } from './restaurantKnowledgeService.ts';
import { sendEvolutionTyping } from './evolutionService.ts';
import type { PopAiEngineResult, PopAiIncomingMessage } from './types.ts';

function normalizeIntentText(text: string) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function minutesSince(dateString?: string | null) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60000;
}

function manualPauseMinutes() {
  const raw = Number(Deno.env.get('WHATSAPP_MANUAL_PAUSE_MINUTES') || '20');
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

function isActionableCustomerIntent(text: string) {
  const value = normalizeIntentText(text);
  return /^(oi+|ola+|opa+|bom dia|boa tarde|boa noite)\b/.test(value) ||
    /(link|cardapio|catalogo|menu|me envia|me manda|manda o link|envia o link|me passa o link)/i.test(value) ||
    /(acompanhar|rastrear|status do pedido|meu pedido|onde.*pedido|pedido.*andamento|pedido.*status)/i.test(value) ||
    /(promo|promocao|desconto|oferta|combo)/i.test(value) ||
    /(quero|queria|gostaria|vou querer|fazer pedido|pedir|pedido|finalizar pedido)/i.test(value);
}

export async function processPopAiMessage(params: PopAiIncomingMessage): Promise<PopAiEngineResult> {
  const startedAt = Date.now();
  const supabase = params.supabase;
  const restaurantId = String(params.restaurantId || '').trim();
  const phone = String(params.customerPhone || '').replace(/\D/g, '');
  const text = String(params.text || '').trim();

  if (!restaurantId || !phone || !text) {
    return { ok: false, skipped: true, reason: 'missing_input' };
  }

  let aiConversation: any = null;
  try {
    const [settings, customer] = await Promise.all([
      getOrCreatePopAiSettings(supabase, restaurantId),
      getOrCreatePopAiCustomer(supabase, restaurantId, phone)
    ]);

    aiConversation = await upsertPopAiConversation(supabase, restaurantId, customer?.id || null, phone, settings.enabled);

    const [knowledge, history] = await Promise.all([
      getRestaurantKnowledge(supabase, restaurantId),
      getConversationHistory(supabase, aiConversation.id, Number(settings.max_history_messages || 30))
    ]);

    if (aiConversation.status === 'human_active' || aiConversation.status === 'human_required') {
      const pausedAt = String(aiConversation?.metadata?.pausedAt || aiConversation?.last_message_at || '');
      const shouldResume =
        minutesSince(pausedAt) >= manualPauseMinutes() &&
        isActionableCustomerIntent(text);

      if (shouldResume) {
        await updatePopAiConversationStatus(supabase, aiConversation.id, 'ai_active', {
          reason: 'auto_resume_after_human_pause',
          previousStatus: aiConversation.status,
          manualPauseMinutes: manualPauseMinutes(),
          resumedAt: new Date().toISOString()
        });
        aiConversation = { ...aiConversation, status: 'ai_active' };
      } else {
        await savePopAiMessage(supabase, aiConversation, 'user', text, {
          skipped: true,
          reason: 'human_conversation_active'
        });
        await logPopAiAction(supabase, restaurantId, aiConversation.id, 'incoming_ignored_human_active', {
          instanceName: params.instanceName,
          phone,
          textPreview: text.slice(0, 180),
          status: aiConversation.status
        });
        return { ok: true, skipped: true, reason: 'bot_paused', aiConversationId: aiConversation.id, status: 'human_active' };
      }
    }

    const systemPrompt = buildPopAiSystemPrompt(settings, knowledge);
    await savePopAiMessage(supabase, aiConversation, 'system', systemPrompt, {
      kind: 'current_restaurant_knowledge',
      productCount: knowledge.productCount,
      historyMessages: history.length
    });
    await savePopAiMessage(supabase, aiConversation, 'user', text, {
      media: params.media ? {
        type: params.media.type,
        mimeType: params.media.mimeType || null,
        hasInlineBytes: Boolean(params.media.hasInlineBytes),
        hasUrl: Boolean(params.media.url)
      } : null
    });

    await logPopAiAction(supabase, restaurantId, aiConversation.id, 'incoming_whatsapp_message', {
      instanceName: params.instanceName,
      phone,
      textPreview: text.slice(0, 180),
      mediaType: params.media?.type || null
    }, {
      aiEnabled: settings.enabled,
      whatsappAiEnabled: knowledge.whatsappAiEnabled
    });

    if (settings.enabled === false || knowledge.whatsappAiEnabled === false || knowledge.whatsappEnabled === false) {
      await updatePopAiConversationStatus(supabase, aiConversation.id, 'human_active', {
        reason: 'ai_disabled',
        updatedAt: new Date().toISOString()
      });
      return { ok: true, skipped: true, reason: 'ai_disabled', aiConversationId: aiConversation.id, status: 'human_active' };
    }

    await sendEvolutionTyping(params.instanceName, phone, 1200).catch(() => null);

    const result = await processRestaurantBotMessage(params);
    const status = classifyAiStatusFromResult(result as PopAiEngineResult);

    if (result?.replyText) {
      await savePopAiMessage(supabase, aiConversation, 'assistant', result.replyText, {
        legacyConversationId: result.conversationId || null,
        status,
        source: 'pop_ai_mvp'
      });
    }

    await updatePopAiConversationStatus(supabase, aiConversation.id, status, {
      lastReason: result?.reason || null,
      legacyConversationId: result?.conversationId || null,
      processingMs: Date.now() - startedAt,
      updatedAt: new Date().toISOString()
    });
    await syncLegacyConversationAiState(supabase, result?.conversationId, aiConversation.id, status);

    await logPopAiAction(supabase, restaurantId, aiConversation.id, result?.ok ? 'ai_response_created' : 'ai_response_failed', {
      textPreview: text.slice(0, 180),
      historyMessages: history.length
    }, {
      ok: result?.ok,
      skipped: result?.skipped || false,
      reason: result?.reason || null,
      status,
      replyPreview: String(result?.replyText || '').slice(0, 220),
      processingMs: Date.now() - startedAt
    }, result?.ok ? null : result?.error);

    return { ...(result as PopAiEngineResult), status, aiConversationId: aiConversation.id };
  } catch (error) {
    const errorText = String((error as any)?.message || error || '');
    if (
      errorText.includes('ai_settings') ||
      errorText.includes('ai_conversations') ||
      errorText.includes('ai_messages') ||
      errorText.includes('ai_logs') ||
      errorText.includes('schema cache')
    ) {
      const fallback = await processRestaurantBotMessage(params);
      return {
        ...(fallback as PopAiEngineResult),
        status: 'ai_active',
        reason: fallback?.reason || 'pop_ai_schema_fallback'
      };
    }

    await logPopAiAction(supabase, restaurantId, aiConversation?.id || null, 'pop_ai_exception', {
      phone,
      textPreview: text.slice(0, 180)
    }, null, error).catch(() => null);
    return { ok: false, error: String((error as any)?.message || error || 'pop_ai_failed'), aiConversationId: aiConversation?.id };
  }
}
