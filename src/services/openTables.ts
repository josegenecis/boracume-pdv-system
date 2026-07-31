import { supabase } from '@/integrations/supabase/client';

const ACTIVE_TABLE_SESSION_STATUSES = ['open', 'serving', 'payment_pending'];

export async function getOpenTableCount(userId: string): Promise<number> {
  const [sessionsResult, tablesResult] = await Promise.all([
    (supabase as any)
      .from('table_sessions')
      .select('table_id')
      .eq('user_id', userId)
      .in('status', ACTIVE_TABLE_SESSION_STATUSES),
    (supabase as any)
      .from('tables')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'occupied'),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (tablesResult.error) throw tablesResult.error;

  const openTableIds = new Set<string>();
  ((sessionsResult.data as Array<{ table_id?: string | null }>) || []).forEach((session) => {
    if (session.table_id) openTableIds.add(session.table_id);
  });
  ((tablesResult.data as Array<{ id?: string | null }>) || []).forEach((table) => {
    if (table.id) openTableIds.add(table.id);
  });

  return openTableIds.size;
}
