// Resolve a restaurant requested by a dashboard call without weakening tenant
// isolation. The authenticated user may use its own restaurant identity; only
// a network owner may act on behalf of an active linked store.
export const resolveStoreUserId = async (
  serviceClient: any,
  authenticatedUserId: string,
  requestedStoreId?: unknown,
) => {
  const requested = String(requestedStoreId || '').trim()
  if (!requested || requested === authenticatedUserId) return authenticatedUserId

  const { data: network, error: networkError } = await serviceClient
    .from('store_networks')
    .select('id')
    .eq('owner_user_id', authenticatedUserId)
    .maybeSingle()
  if (networkError || !network?.id) throw new Error('store_access_denied')

  const { data: store, error: storeError } = await serviceClient
    .from('store_network_stores')
    .select('store_user_id')
    .eq('network_id', network.id)
    .eq('store_user_id', requested)
    .eq('status', 'active')
    .maybeSingle()
  if (storeError || !store?.store_user_id) throw new Error('store_access_denied')
  return requested
}
