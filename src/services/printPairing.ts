import { supabase } from '@/integrations/supabase/client'

export const claimBridgePairing = async (params: { pairingCode: string; name?: string }) => {
  const { data, error } = await supabase.functions.invoke('print-agent-pair-claim', {
    body: { pairingCode: params.pairingCode, name: params.name || null }
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Falha ao vincular')
  return true
}

