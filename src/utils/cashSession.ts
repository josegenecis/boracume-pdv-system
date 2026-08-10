import { supabase } from '@/integrations/supabase/client';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export function getCashSessionDeadline(openedAt: string, openingHours?: string | null): Date {
  const opened = new Date(openedAt);
  const fallback = { open: '10:00', close: '22:00', closed: false };
  let schedule: Record<string, { open?: string; close?: string; closed?: boolean }> = {};
  try { schedule = JSON.parse(String(openingHours || '{}')); } catch {
    const match = String(openingHours || '').match(/(\d{2}:\d{2})\s*[-àa]+\s*(\d{2}:\d{2})/i);
    if (match) schedule = Object.fromEntries(DAY_KEYS.map((key) => [key, { open: match[1], close: match[2], closed: false }]));
  }
  const day = schedule[DAY_KEYS[opened.getDay()]] || fallback;
  const [openHour, openMinute] = String(day.open || fallback.open).split(':').map(Number);
  const [closeHour, closeMinute] = String(day.close || fallback.close).split(':').map(Number);
  const deadline = new Date(opened);
  deadline.setHours(closeHour || 0, closeMinute || 0, 0, 0);
  const opens = new Date(opened);
  opens.setHours(openHour || 0, openMinute || 0, 0, 0);
  if (deadline <= opens || deadline <= opened) deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(deadline.getHours() + 2);
  return deadline;
}

export function isCashSessionOverdue(openedAt?: string | null, openingHours?: string | null, now = new Date()) {
  if (!openedAt) return false;
  return now.getTime() > getCashSessionDeadline(openedAt, openingHours).getTime();
}

export async function getOpenCashRegisterSession(userId?: string | null) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) return null;

  const { data, error } = await supabase
    .from('cash_register_sessions' as any)
    .select('id, opened_at, initial_amount, status')
    .eq('user_id', safeUserId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}
