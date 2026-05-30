import type { PopAiConversation } from './types.ts';
import { logPopAiAction, updatePopAiConversationStatus } from './aiConversationService.ts';

export async function transferToHuman(
  supabase: any,
  conversation: PopAiConversation,
  legacyConversationId: string | null,
  reason: string,
  assignedTo?: string | null
) {
  await updatePopAiConversationStatus(supabase, conversation.id, 'human_required', {
    reason,
    assignedTo: assignedTo || null,
    transferredAt: new Date().toISOString()
  });

  if (legacyConversationId) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        status: 'bot_paused',
        bot_paused: true,
        bot_paused_at: new Date().toISOString(),
        bot_paused_by: assignedTo || null,
        ai_status: 'human_required',
        human_required: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', legacyConversationId);
  }

  await logPopAiAction(supabase, conversation.restaurant_id, conversation.id, 'transfer_to_human', { reason, assignedTo });
}

export async function releaseToAi(supabase: any, conversation: PopAiConversation, legacyConversationId: string | null) {
  await updatePopAiConversationStatus(supabase, conversation.id, 'ai_active', {
    releasedAt: new Date().toISOString()
  });

  if (legacyConversationId) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        status: 'active',
        bot_paused: false,
        bot_paused_at: null,
        bot_paused_by: null,
        ai_status: 'ai_active',
        human_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', legacyConversationId);
  }

  await logPopAiAction(supabase, conversation.restaurant_id, conversation.id, 'release_to_ai');
}
