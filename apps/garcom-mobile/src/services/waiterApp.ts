import type { User } from '@supabase/supabase-js';
import { readCache, writeCache } from '../lib/cache';
import { minutesSince } from '../lib/format';
import { supabase } from '../lib/supabase';
import type {
  AddItemInput,
  OperatorProfile,
  OrderItem,
  OrderItemOption,
  PaymentMethod,
  PaymentRecord,
  Product,
  ProductCategory,
  ProductOption,
  ProductVariationGroup,
  RestaurantTable,
  SessionHistoryEntry,
  SessionOpenInput,
  SessionStatus,
  TableAccount,
  TableSession,
  TableStatus,
} from '../types/domain';

function getSchemaError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '');
  if (
    message.includes('table_sessions') ||
    message.includes('order_items') ||
    message.includes('payments')
  ) {
    return new Error('A estrutura do APP Garçom ainda não foi aplicada no Supabase. Rode a migration nova antes de operar em produção.');
  }
  return error instanceof Error ? error : new Error('Erro inesperado no app do garçom.');
}

function mapSessionToTableStatus(status?: string | null): TableStatus {
  if (status === 'payment_pending') {
    return 'payment_pending';
  }
  if (status === 'serving') {
    return 'serving';
  }
  if (status === 'open') {
    return 'occupied';
  }
  return 'free';
}

function mapTableStatus(status?: string | null): TableStatus {
  if (status === 'payment_pending') {
    return 'payment_pending';
  }
  if (status === 'serving') {
    return 'serving';
  }
  if (status === 'occupied' || status === 'reserved') {
    return 'occupied';
  }
  if (status === 'available') {
    return 'free';
  }
  return 'free';
}

function mapAccountStatus(value?: string | null): 'open' | 'paid' {
  return value === 'paid' ? 'paid' : 'open';
}

function makeHistoryEntries(items: OrderItem[], payments: PaymentRecord[]): SessionHistoryEntry[] {
  const itemEntries = items.map((item) => ({
    id: `item-${item.id}`,
    type: 'item' as const,
    label: `${item.quantity}x ${item.productName}`,
    timestamp: item.sentAt ?? item.createdAt,
    amount: item.totalPrice,
  }));
  const paymentEntries = payments.map((payment) => ({
    id: `payment-${payment.id}`,
    type: 'payment' as const,
    label: `Pagamento ${payment.method.toUpperCase()}`,
    timestamp: payment.createdAt,
    amount: payment.amount,
  }));
  return [...itemEntries, ...paymentEntries].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function buildOptionsMap(optionRows: any[]) {
  const map = new Map<string, OrderItemOption[]>();
  optionRows.forEach((row) => {
    const option: OrderItemOption = {
      id: row.id,
      orderItemId: row.order_item_id,
      optionName: row.option_name,
      price: Number(row.price || 0),
      quantity: Number(row.quantity || 1),
    };
    const current = map.get(row.order_item_id) ?? [];
    map.set(row.order_item_id, [...current, option]);
  });
  return map;
}

function buildItemTotal(row: any, options: OrderItemOption[]) {
  const unitPrice = Number(row.unit_price ?? row.price ?? 0);
  const quantity = Number(row.quantity ?? 1);
  const optionsTotal = options.reduce((sum, option) => sum + option.price * option.quantity, 0);
  return unitPrice * quantity + optionsTotal;
}

function buildProductVariationGroups(
  productId: string,
  specificRows: any[],
  linkRows: any[],
  globalRows: any[],
): ProductVariationGroup[] {
  const directGroups = specificRows
    .filter((row) => row.product_id === productId)
    .map((row) => ({
      id: row.id,
      name: String(row.name),
      required: Boolean(row.required),
      maxSelections: Math.max(1, Number(row.max_selections ?? 1)),
      options: Array.isArray(row.options)
        ? row.options.map((option: any, index: number) => ({
            id: `${row.id}-${index}-${option.name}`,
            name: String(option.name),
            price: Number(option.price ?? 0),
          }))
        : [],
    }));

  const links = linkRows.filter((row) => row.product_id === productId);
  const globalGroups = links
    .map((link) => {
      const globalRow = globalRows.find((row) => row.id === link.global_variation_id);
      if (!globalRow) {
        return null;
      }
      return {
        id: String(globalRow.id),
        name: String(globalRow.name),
        required: Boolean(link.required ?? globalRow.required),
        maxSelections: Math.max(1, Number(link.max_selections ?? globalRow.max_selections ?? 1)),
        options: Array.isArray(globalRow.options)
          ? globalRow.options.map((option: any, index: number) => ({
              id: `${globalRow.id}-${index}-${option.name}`,
              name: String(option.name),
              price: Number(option.price ?? 0),
            }))
          : [],
      };
    })
    .filter(Boolean) as ProductVariationGroup[];

  return [...directGroups, ...globalGroups];
}

async function refreshAccountTotal(accountId: string) {
  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, price, status')
    .eq('account_id', accountId)
    .neq('status', 'cancelled');

  if (itemError) {
    throw getSchemaError(itemError);
  }

  const itemIds = (itemRows ?? []).map((row) => row.id);
  const { data: optionRows, error: optionError } = itemIds.length
    ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
    : { data: [], error: null };

  if (optionError) {
    throw getSchemaError(optionError);
  }

  const optionsMap = buildOptionsMap(optionRows ?? []);
  const total = (itemRows ?? []).reduce((sum, row) => {
    const options = optionsMap.get(row.id) ?? [];
    return sum + buildItemTotal(row, options);
  }, 0);

  const { error: updateError } = await supabase
    .from('table_accounts')
    .update({ total })
    .eq('id', accountId);

  if (updateError) {
    throw getSchemaError(updateError);
  }
}

async function refreshSessionStatus(sessionId: string) {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('table_sessions')
    .select('id, table_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    throw getSchemaError(sessionError);
  }

  const { data: accountRows, error: accountError } = await supabase
    .from('table_accounts')
    .select('id, status, total')
    .eq('session_id', sessionId)
    .order('account_number');

  if (accountError) {
    throw getSchemaError(accountError);
  }

  const accountIds = (accountRows ?? []).map((row) => row.id);
  const { data: itemRows, error: itemError } = accountIds.length
    ? await supabase
        .from('order_items')
        .select('id, account_id, status')
        .in('account_id', accountIds)
    : { data: [], error: null };

  if (itemError) {
    throw getSchemaError(itemError);
  }

  const hasSentItems = (itemRows ?? []).some((row) => row.status === 'sent');
  const allAccountsPaid =
    (accountRows ?? []).length > 0 && (accountRows ?? []).every((row) => row.status === 'paid');

  let sessionStatus: SessionStatus = 'open';
  let tableStatus = 'occupied';

  if (allAccountsPaid) {
    sessionStatus = 'closed';
    tableStatus = 'available';
  } else if (hasSentItems) {
    sessionStatus = 'serving';
    tableStatus = 'serving';
  }

  const { error: updateSessionError } = await supabase
    .from('table_sessions')
    .update({
      status: sessionStatus,
      closed_at: sessionStatus === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', sessionId);

  if (updateSessionError) {
    throw getSchemaError(updateSessionError);
  }

  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: tableStatus })
    .eq('id', sessionRow.table_id);

  if (updateTableError) {
    throw getSchemaError(updateTableError);
  }
}

async function fetchPaymentsForSession(sessionId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw getSchemaError(error);
  }

  return (data ?? []).map(
    (row): PaymentRecord => ({
      id: row.id,
      sessionId: row.session_id,
      accountId: row.account_id,
      method: row.method,
      amount: Number(row.amount ?? 0),
      createdAt: row.created_at,
    }),
  );
}

export async function resolveOperatorProfile(user: User): Promise<OperatorProfile> {
  const { data, error } = await supabase
    .from('waiters')
    .select('id, user_id, name, role, email')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw getSchemaError(error);
  }

  if (data) {
    return {
      id: data.id,
      restaurantId: data.user_id,
      name: data.name,
      email: data.email || user.email || '',
      role: data.role || 'waiter',
    };
  }

  return {
    id: user.id,
    restaurantId: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Operador',
    email: user.email || '',
    role: 'owner',
  };
}

export async function listRestaurantTables(userId: string) {
  try {
    const { data: tableRows, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('user_id', userId)
      .order('table_number');

    if (tableError) {
      throw getSchemaError(tableError);
    }

    const { data: sessionRows, error: sessionError } = await supabase
      .from('table_sessions')
      .select('id, table_id, opened_at, status')
      .eq('user_id', userId)
      .in('status', ['open', 'serving', 'payment_pending'])
      .order('opened_at', { ascending: false });

    if (sessionError) {
      throw getSchemaError(sessionError);
    }

    const latestSessionByTable = new Map<string, any>();
    (sessionRows ?? []).forEach((row) => {
      if (!latestSessionByTable.has(row.table_id)) {
        latestSessionByTable.set(row.table_id, row);
      }
    });

    const sessionIds = (sessionRows ?? []).map((row) => row.id);
    const { data: accountRows, error: accountError } = sessionIds.length
      ? await supabase.from('table_accounts').select('session_id, total').in('session_id', sessionIds)
      : { data: [], error: null };

    if (accountError) {
      throw getSchemaError(accountError);
    }

    const totalsBySession = new Map<string, number>();
    (accountRows ?? []).forEach((row) => {
      totalsBySession.set(row.session_id, (totalsBySession.get(row.session_id) ?? 0) + Number(row.total ?? 0));
    });

    const tables = (tableRows ?? []).map(
      (row): RestaurantTable => {
        const session = latestSessionByTable.get(row.id);
        const sessionTotal = session ? totalsBySession.get(session.id) ?? 0 : 0;
        return {
          id: row.id,
          number: Number(row.table_number),
          capacity: Number(row.capacity ?? 0),
          location: row.location,
          status: session ? mapSessionToTableStatus(session.status) : mapTableStatus(row.status),
          total: sessionTotal,
          openMinutes: session?.opened_at ? minutesSince(session.opened_at) : 0,
          sessionId: session?.id ?? null,
        };
      },
    );

    await writeCache(`tables:${userId}`, tables);
    return tables;
  } catch (error) {
    const cached = await readCache<RestaurantTable[]>(`tables:${userId}`);
    if (cached) {
      return cached;
    }
    throw getSchemaError(error);
  }
}

export async function getSessionDetails(sessionId: string) {
  try {
    const { data: sessionRow, error: sessionError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      throw getSchemaError(sessionError);
    }

    const { data: tableRow, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', sessionRow.table_id)
      .single();

    if (tableError) {
      throw getSchemaError(tableError);
    }

    const { data: accountRows, error: accountError } = await supabase
      .from('table_accounts')
      .select('*')
      .eq('session_id', sessionId)
      .order('account_number');

    if (accountError) {
      throw getSchemaError(accountError);
    }

    const accountIds = (accountRows ?? []).map((row) => row.id);
    const { data: itemRows, error: itemError } = accountIds.length
      ? await supabase
          .from('order_items')
          .select('*')
          .in('account_id', accountIds)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: true })
      : { data: [], error: null };

    if (itemError) {
      throw getSchemaError(itemError);
    }

    const itemIds = (itemRows ?? []).map((row) => row.id);
    const { data: optionRows, error: optionError } = itemIds.length
      ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
      : { data: [], error: null };

    if (optionError) {
      throw getSchemaError(optionError);
    }

    const optionsMap = buildOptionsMap(optionRows ?? []);
    const items: OrderItem[] = (itemRows ?? []).map((row) => {
      const options = optionsMap.get(row.id) ?? [];
      return {
        id: row.id,
        sessionId: row.session_id,
        accountId: row.account_id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity ?? 1),
        unitPrice: Number(row.unit_price ?? row.price ?? 0),
        totalPrice: buildItemTotal(row, options),
        notes: row.notes || '',
        status: row.status,
        createdAt: row.created_at,
        sentAt: row.sent_at,
        options,
      };
    });

    const payments = await fetchPaymentsForSession(sessionId);
    const accounts: TableAccount[] = (accountRows ?? []).map((row) => {
      const accountItems = items.filter((item) => item.accountId === row.id);
      return {
        id: row.id,
        sessionId: row.session_id,
        name: row.name || `Conta ${row.account_number ?? 1}`,
        total: Number(row.total ?? 0),
        status: mapAccountStatus(row.status),
        itemCount: accountItems.length,
        items: accountItems,
      };
    });

    const session: TableSession = {
      id: sessionRow.id,
      tableId: sessionRow.table_id,
      tableNumber: Number(tableRow.table_number),
      openedAt: sessionRow.opened_at,
      closedAt: sessionRow.closed_at,
      guestCount: Number(sessionRow.guest_count ?? accounts.length),
      status: sessionRow.status,
      accounts,
      history: makeHistoryEntries(items, payments),
    };

    await writeCache(`session:${sessionId}`, session);
    return session;
  } catch (error) {
    const cached = await readCache<TableSession>(`session:${sessionId}`);
    if (cached) {
      return cached;
    }
    throw getSchemaError(error);
  }
}

export async function openTableSession(input: SessionOpenInput) {
  const existing = await supabase
    .from('table_sessions')
    .select('id')
    .eq('table_id', input.tableId)
    .in('status', ['open', 'serving', 'payment_pending'])
    .maybeSingle();

  if (existing.error) {
    throw getSchemaError(existing.error);
  }

  if (existing.data?.id) {
    return existing.data.id;
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('table_sessions')
    .insert({
      user_id: input.operator.restaurantId,
      table_id: input.tableId,
      status: 'open',
      opened_at: new Date().toISOString(),
      guest_count: input.guestCount,
      opened_by_waiter_id: input.operator.id,
    })
    .select('id')
    .single();

  if (sessionError) {
    throw getSchemaError(sessionError);
  }

  const accountsToInsert = Array.from({ length: input.guestCount }, (_, index) => ({
    user_id: input.operator.restaurantId,
    session_id: sessionRow.id,
    table_id: null,
    account_number: index + 1,
    name: `Conta ${index + 1}`,
    total: 0,
    status: 'open',
    opened_by_waiter_id: input.operator.id,
    opened_at: new Date().toISOString(),
    items: [],
  }));

  const { error: accountError } = await supabase.from('table_accounts').insert(accountsToInsert);
  if (accountError) {
    throw getSchemaError(accountError);
  }

  const { error: tableError } = await supabase
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', input.tableId);

  if (tableError) {
    throw getSchemaError(tableError);
  }

  return sessionRow.id;
}

export async function createAccount(sessionId: string, restaurantId: string, name: string, operatorId: string) {
  const { data: rows, error: listError } = await supabase
    .from('table_accounts')
    .select('account_number')
    .eq('session_id', sessionId)
    .order('account_number', { ascending: false })
    .limit(1);

  if (listError) {
    throw getSchemaError(listError);
  }

  const nextNumber = Number(rows?.[0]?.account_number ?? 0) + 1;
  const { error } = await supabase.from('table_accounts').insert({
    user_id: restaurantId,
    session_id: sessionId,
    table_id: null,
    account_number: nextNumber,
    name,
    total: 0,
    status: 'open',
    opened_by_waiter_id: operatorId,
    opened_at: new Date().toISOString(),
    items: [],
  });

  if (error) {
    throw getSchemaError(error);
  }
}

export async function renameAccount(accountId: string, name: string) {
  const { error } = await supabase.from('table_accounts').update({ name }).eq('id', accountId);
  if (error) {
    throw getSchemaError(error);
  }
}

export async function removeEmptyAccount(accountId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select('id')
    .eq('account_id', accountId)
    .limit(1);

  if (error) {
    throw getSchemaError(error);
  }

  if (data && data.length > 0) {
    throw new Error('Só é possível remover conta vazia.');
  }

  const { error: deleteError } = await supabase.from('table_accounts').delete().eq('id', accountId);
  if (deleteError) {
    throw getSchemaError(deleteError);
  }
}

export async function listCatalog(userId: string) {
  try {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('product_categories')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    if (categoryError) {
      throw getSchemaError(categoryError);
    }

    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('show_in_pdv', true)
      .order('name', { ascending: true });

    if (productError) {
      throw getSchemaError(productError);
    }

    const productIds = (productRows ?? []).map((row) => row.id);
    const { data: specificRows, error: specificError } = productIds.length
      ? await supabase.from('product_variations').select('*').in('product_id', productIds)
      : { data: [], error: null };

    if (specificError) {
      throw getSchemaError(specificError);
    }

    const { data: linkRows, error: linkError } = productIds.length
      ? await supabase
          .from('product_global_variation_links')
          .select('*')
          .in('product_id', productIds)
      : { data: [], error: null };

    if (linkError) {
      throw getSchemaError(linkError);
    }

    const globalIds = (linkRows ?? []).map((row) => row.global_variation_id);
    const { data: globalRows, error: globalError } = globalIds.length
      ? await supabase.from('global_variations').select('*').in('id', globalIds)
      : { data: [], error: null };

    if (globalError) {
      throw getSchemaError(globalError);
    }

    const products = (productRows ?? []).map(
      (row): Product => ({
        id: row.id,
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        price: Number(row.price ?? 0),
        featured: Boolean(row.featured ?? row.is_featured),
        sendToKds: Boolean(row.send_to_kds ?? true),
        variations: buildProductVariationGroups(row.id, specificRows ?? [], linkRows ?? [], globalRows ?? []),
      }),
    );

    const categories: ProductCategory[] = (categoryRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      products: products.filter((product) => product.categoryId === row.id),
    }));

    const favorites: ProductCategory = {
      id: 'favorites',
      name: 'Favoritos',
      products: products.filter((product) => product.featured),
    };

    const catalog = favorites.products.length > 0 ? [favorites, ...categories] : categories;
    await writeCache(`catalog:${userId}`, catalog);
    return catalog;
  } catch (error) {
    const cached = await readCache<ProductCategory[]>(`catalog:${userId}`);
    if (cached) {
      return cached;
    }
    throw getSchemaError(error);
  }
}

export async function addItemToAccount(input: AddItemInput) {
  const selectedOptions = input.selectedOptions.map((option) => ({
    option_name: option.name,
    price: option.price,
    quantity: 1,
  }));

  const { data: itemRow, error: itemError } = await supabase
    .from('order_items')
    .insert({
      session_id: input.sessionId,
      account_id: input.accountId,
      product_id: input.product.id,
      product_name: input.product.name,
      quantity: input.quantity,
      unit_price: input.product.price,
      notes: input.notes,
      status: 'draft',
    })
    .select('id')
    .single();

  if (itemError) {
    throw getSchemaError(itemError);
  }

  if (selectedOptions.length > 0) {
    const { error: optionError } = await supabase
      .from('order_item_options')
      .insert(selectedOptions.map((option) => ({ ...option, order_item_id: itemRow.id })));

    if (optionError) {
      throw getSchemaError(optionError);
    }
  }

  await refreshAccountTotal(input.accountId);
  await refreshSessionStatus(input.sessionId);
}

export async function cancelDraftItem(itemId: string, accountId: string, sessionId: string) {
  const { data: row, error: rowError } = await supabase
    .from('order_items')
    .select('id, status')
    .eq('id', itemId)
    .maybeSingle();

  if (rowError) {
    throw getSchemaError(rowError);
  }

  if (!row) {
    throw new Error('Item não encontrado.');
  }

  if (row.status !== 'draft') {
    throw new Error('Só é possível cancelar itens que ainda não foram enviados.');
  }

  const { error: updateError } = await supabase
    .from('order_items')
    .update({ status: 'cancelled' })
    .eq('id', itemId);

  if (updateError) {
    throw getSchemaError(updateError);
  }

  await refreshAccountTotal(accountId);
  await refreshSessionStatus(sessionId);
}

export async function sendAccountItems(sessionId: string, account: TableAccount, operator: OperatorProfile) {
  const draftRows = await supabase
    .from('order_items')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: true });

  if (draftRows.error) {
    throw getSchemaError(draftRows.error);
  }

  if (!draftRows.data || draftRows.data.length === 0) {
    throw new Error('Nenhum item novo para enviar.');
  }

  const itemIds = draftRows.data.map((row) => row.id);
  const optionRows = itemIds.length
    ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
    : { data: [], error: null };

  if (optionRows.error) {
    throw getSchemaError(optionRows.error);
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('table_sessions')
    .select('table_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    throw getSchemaError(sessionError);
  }

  const optionsMap = buildOptionsMap(optionRows.data ?? []);
  const orderItems = draftRows.data.map((row) => {
    const options = optionsMap.get(row.id) ?? [];
    return {
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: Number(row.quantity ?? 1),
      price: Number(row.unit_price ?? 0),
      subtotal: buildItemTotal(row, options),
      options: options.map((option) => option.optionName),
      notes: row.notes || '',
    };
  });

  const total = orderItems.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);
  const orderNumber = `M${new Date().getTime().toString().slice(-6)}`;
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: operator.restaurantId,
      order_number: orderNumber,
      customer_name: account.name,
      table_id: sessionRow.table_id,
      items: orderItems,
      total,
      order_type: 'dine_in',
      payment_method: 'pendente',
      status: 'pending',
      session_id: sessionId,
      account_id: account.id,
      waiter_id: operator.id,
    })
    .select('id')
    .single();

  if (orderError) {
    throw getSchemaError(orderError);
  }

  const { error: updateError } = await supabase
    .from('order_items')
    .update({
      status: 'sent',
      order_id: orderRow.id,
      sent_at: new Date().toISOString(),
    })
    .in('id', itemIds);

  if (updateError) {
    throw getSchemaError(updateError);
  }

  await refreshSessionStatus(sessionId);
}

export async function recordPayment(
  sessionId: string,
  accountId: string | null,
  amount: number,
  method: PaymentMethod,
  operator: OperatorProfile,
) {
  const { error: paymentError } = await supabase.from('payments').insert({
    session_id: sessionId,
    account_id: accountId,
    user_id: operator.restaurantId,
    waiter_id: operator.id,
    method,
    amount,
  });

  if (paymentError) {
    throw getSchemaError(paymentError);
  }

  if (accountId) {
    const { error: accountError } = await supabase
      .from('table_accounts')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (accountError) {
      throw getSchemaError(accountError);
    }
  } else {
    const { error: accountError } = await supabase
      .from('table_accounts')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);

    if (accountError) {
      throw getSchemaError(accountError);
    }
  }

  await refreshSessionStatus(sessionId);
}

export async function listenRestaurantRealtime(restaurantId: string, onChange: () => void) {
  const channel = supabase
    .channel(`waiter-app-${restaurantId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_accounts' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function buildEqualSplit(total: number, peopleCount: number) {
  if (!peopleCount) {
    return [];
  }
  const perPerson = total / peopleCount;
  return Array.from({ length: peopleCount }, (_, index) => ({
    id: `${index + 1}`,
    label: `Pessoa ${index + 1}`,
    amount: perPerson,
  }));
}

export function buildItemSplit(accounts: TableAccount[]) {
  return accounts.map((account) => ({
    id: account.id,
    label: account.name,
    amount: account.total,
  }));
}

export function getSessionTotal(accounts: TableAccount[]) {
  return accounts.reduce((sum, account) => sum + account.total, 0);
}
