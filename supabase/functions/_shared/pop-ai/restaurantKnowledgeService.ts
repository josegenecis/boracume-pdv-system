export async function getRestaurantKnowledge(supabase: any, restaurantId: string) {
  const [profileResult, productsResult, categoriesResult, promotionsResult, settingsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('restaurant_name, opening_hours, address, delivery_fee')
      .eq('id', restaurantId)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, name, description, price, available, category_id, category, send_to_kds, receipt_ingredients, receipt_ingredients_enabled')
      .eq('user_id', restaurantId)
      .eq('available', true)
      .order('name', { ascending: true })
      .limit(160),
    supabase
      .from('product_categories')
      .select('id, name, active, display_order')
      .eq('user_id', restaurantId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .limit(80),
    supabase
      .from('promotional_banners')
      .select('id, title, subtitle, active, banner_type')
      .eq('user_id', restaurantId)
      .eq('active', true)
      .limit(20),
    supabase
      .from('whatsapp_settings')
      .select('enabled, ai_enabled, default_message')
      .eq('user_id', restaurantId)
      .maybeSingle()
  ]);

  const profile = profileResult.data || {};
  const products = productsResult.data || [];
  const categories = categoriesResult.data || [];
  const promotions = promotionsResult.data || [];

  return {
    restaurantId,
    restaurantName: profile.restaurant_name || 'Restaurante',
    openingHours: profile.opening_hours || null,
    address: profile.address || null,
    deliveryFee: profile.delivery_fee || 0,
    whatsappEnabled: settingsResult.data?.enabled !== false,
    whatsappAiEnabled: settingsResult.data?.ai_enabled !== false,
    defaultMessage: settingsResult.data?.default_message || null,
    categories,
    products,
    promotions,
    productCount: products.length
  };
}

export function formatKnowledgeSummary(knowledge: any) {
  const categoriesById = new Map((knowledge.categories || []).map((category: any) => [category.id, category.name]));
  const products = (knowledge.products || [])
    .slice(0, 80)
    .map((product: any) => {
      const categoryName = categoriesById.get(product.category_id) || 'Sem categoria';
      return `- ${product.name} (${categoryName || product.category || 'Sem categoria'}) - R$ ${Number(product.price || 0).toFixed(2)}${product.description ? `: ${product.description}` : ''}`;
    })
    .join('\n');

  const promotions = (knowledge.promotions || [])
    .map((promotion: any) => `- ${promotion.title}${promotion.subtitle ? `: ${promotion.subtitle}` : ''}`)
    .join('\n');

  return [
    `Restaurante: ${knowledge.restaurantName}`,
    knowledge.address ? `Endereço: ${knowledge.address}` : '',
    knowledge.openingHours ? `Horários: ${JSON.stringify(knowledge.openingHours)}` : '',
    `Taxa de entrega padrão: R$ ${Number(knowledge.deliveryFee || 0).toFixed(2)}`,
    promotions ? `Promoções ativas:\n${promotions}` : 'Promoções ativas: nenhuma cadastrada',
    products ? `Cardápio ativo:\n${products}` : 'Cardápio ativo: nenhum produto disponível'
  ].filter(Boolean).join('\n');
}
