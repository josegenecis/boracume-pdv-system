import { supabase } from '@/integrations/supabase/client';

export async function isFiscalEmissionActiveForUser(userId?: string | null) {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from('fiscal_settings')
      .select('ativo')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.ativo);
  } catch (error) {
    console.warn('Nao foi possivel verificar se a NFC-e esta ativa:', error);
    return false;
  }
}

export async function emitNfceForOrder(order: any, consumerData?: any, observacoes = '') {
  if (!order?.id) {
    throw new Error('Pedido invalido para emissao fiscal.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Login nao confirmado. Saia e entre novamente antes de emitir a NFC-e.');
  }

  const response = await fetch('/api/nfce/emit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      order_id: order.id,
      consumer_data: consumerData ?? (order.customer_name ? { nome: order.customer_name } : null),
      observacoes,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Erro ao emitir cupom fiscal.');
  }
  if (!data?.success) {
    throw new Error(data?.motivo || data?.error || 'A NFC-e foi rejeitada pela Sefaz.');
  }

  return data;
}
