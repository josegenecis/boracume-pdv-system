import type { PopAiConversation } from './types.ts';
import { logPopAiAction, updatePopAiConversationStatus } from './aiConversationService.ts';

function getHumanHandoffPauseWindow() {
  const rawMinutes = Number(Deno.env.get('WHATSAPP_MANUAL_PAUSE_MINUTES') || '60');
  const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 60;
  const now = new Date();
  const resumeAt = new Date(now.getTime() + minutes * 60000);

  return {
    nowIso: now.toISOString(),
    resumeAtIso: resumeAt.toISOString(),
    status: `bot_paused_until:${resumeAt.toISOString()}`
  };
}

export async function transferToHuman(
  supabase: any,
  conversation: PopAiConversation,
  legacyConversationId: string | null,
  reason: string,
  assignedTo?: string | null
) {
  const pause = getHumanHandoffPauseWindow();
  await updatePopAiConversationStatus(supabase, conversation.id, 'human_required', {
    reason,
    assignedTo: assignedTo || null,
    transferredAt: pause.nowIso,
    aiResumeAt: pause.resumeAtIso,
    lastHumanMessageAt: pause.nowIso,
    handoffMode: 'temporary_human_owner'
  });

  if (legacyConversationId) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        status: pause.status,
        bot_paused: true,
        bot_paused_at: pause.nowIso,
        bot_paused_by: assignedTo || null,
        ai_status: 'human_required',
        human_required: true,
        owner: 'HUMAN',
        current_state: 'HUMAN_ATTENDING',
        last_human_message_at: pause.nowIso,
        ai_resume_at: pause.resumeAtIso,
        metadata: {
          reason,
          assignedTo: assignedTo || null,
          transferredAt: pause.nowIso,
          aiResumeAt: pause.resumeAtIso,
          lastHumanMessageAt: pause.nowIso,
          handoffMode: 'temporary_human_owner'
        },
        updated_at: pause.nowIso
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
        owner: 'AI',
        current_state: 'IDLE',
        ai_resume_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', legacyConversationId);
  }

  await logPopAiAction(supabase, conversation.restaurant_id, conversation.id, 'release_to_ai');
}
