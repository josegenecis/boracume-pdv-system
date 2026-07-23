import { supabase } from '@/integrations/supabase/client';

const DEFAULT_TABLE_COUNT = 50;
const DEFAULT_TABLE_CAPACITY = 4;

export async function ensureDefaultTables(userId?: string | null) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('user_id', userId)
    .order('table_number');

  if (error) throw error;

  const existingTables = data || [];
  const visibleTables = existingTables.filter((table) => !table.archived_at);
  const existingNumbers = new Set(
    existingTables
      .map((table) => Number(table.table_number))
      .filter((tableNumber) => Number.isFinite(tableNumber))
  );

  const missingNumbers = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, index) => index + 1)
    .filter((tableNumber) => !existingNumbers.has(tableNumber));

  if (missingNumbers.length === 0) {
    return visibleTables;
  }

  const { error: insertError } = await supabase
    .from('tables')
    .insert(
      missingNumbers.map((tableNumber) => ({
        user_id: userId,
        table_number: tableNumber,
        capacity: DEFAULT_TABLE_CAPACITY,
        location: '',
        status: 'available',
      }))
    );

  if (insertError) throw insertError;

  const { data: refreshedTables, error: refreshError } = await supabase
    .from('tables')
    .select('*')
    .eq('user_id', userId)
    .order('table_number');

  if (refreshError) throw refreshError;

  return (refreshedTables || []).filter((table) => !table.archived_at);
}
