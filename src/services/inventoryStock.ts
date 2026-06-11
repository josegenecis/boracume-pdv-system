import { supabase } from '@/integrations/supabase/client';

type StockItem = {
  product_id?: string | null;
  id?: string | null;
  quantity?: number | string | null;
};

const normalizeItems = (items: StockItem[]) => {
  const grouped = new Map<string, number>();

  for (const item of items || []) {
    const productId = String(item?.product_id || item?.id || '').trim();
    const quantity = Math.max(0, Math.trunc(Number(item?.quantity || 0)));
    if (!productId || quantity <= 0) continue;
    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }

  return Array.from(grouped.entries()).map(([productId, quantity]) => ({ productId, quantity }));
};

export async function applyProductStockForOrder(params: {
  userId?: string | null;
  orderId?: string | null;
  items: StockItem[];
}) {
  const userId = String(params.userId || '').trim();
  const orderId = String(params.orderId || '').trim();
  const items = normalizeItems(params.items);

  if (!userId || !orderId || items.length === 0) {
    return { updated: 0, skipped: true };
  }

  let updated = 0;
  let disabled = 0;

  for (const item of items) {
    const { data: product, error: productError } = await (supabase as any)
      .from('products')
      .select('id,track_stock,stock_quantity,available,is_available,show_in_delivery')
      .eq('id', item.productId)
      .eq('user_id', userId)
      .maybeSingle();

    if (productError || !product?.track_stock) continue;

    const { data: existingMovement } = await (supabase as any)
      .from('inventory_movements')
      .select('id')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .eq('product_id', item.productId)
      .eq('type', 'sale')
      .maybeSingle();

    if (existingMovement?.id) continue;

    const { error: movementError } = await (supabase as any)
      .from('inventory_movements')
      .insert({
        user_id: userId,
        product_id: item.productId,
        order_id: orderId,
        type: 'sale',
        quantity: -item.quantity,
      });

    if (movementError) continue;

    const current = Math.max(0, Math.trunc(Number(product.stock_quantity || 0)));
    const next = Math.max(0, current - item.quantity);
    const updateData: Record<string, unknown> = { stock_quantity: next };

    if (next <= 0) {
      updateData.available = false;
      updateData.is_available = false;
      updateData.show_in_delivery = false;
      disabled += 1;
    }

    const { error: updateError } = await (supabase as any)
      .from('products')
      .update(updateData)
      .eq('id', item.productId)
      .eq('user_id', userId);

    if (!updateError) updated += 1;
  }

  return { updated, disabled, skipped: false };
}

