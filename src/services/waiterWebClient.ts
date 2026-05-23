import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';

export type TableStatus = 'free' | 'occupied' | 'preparing' | 'ready' | 'check_requested' | 'partially_paid';
export type SessionStatus = 'open' | 'serving' | 'payment_pending' | 'closed';
export type AccountStatus = 'open' | 'preparing' | 'ready' | 'check_requested' | 'partially_paid' | 'paid';
export type KitchenStatus = 'idle' | 'sent' | 'preparing' | 'ready' | 'delivered';
export type OrderItemStatus = 'draft' | 'sent' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'pix' | 'card';

export type WaiterWebProfile = {
  id: string;
  restaurantId: string;
  name: string;
  cpf: string;
  role: string;
  permissions: Record<string, boolean>;
};

export type WaiterWebStoredSession = {
  token: string;
  profile: WaiterWebProfile;
  expiresAt: string;
};

export type WaiterTableChoice = {
  id: string;
  number: number;
  location?: string | null;
  capacity: number;
  status: 'free' | 'occupied' | 'current';
  sessionId?: string | null;
  canReceiveTableTransfer: boolean;
  canReceiveAccountTransfer: boolean;
};

export type RestaurantTable = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  location?: string | null;
  status: TableStatus;
  total: number;
  paidTotal: number;
  dueAmount: number;
  openMinutes: number;
  sessionId?: string | null;
  accountCount: number;
  itemCount: number;
  sentItemsCount: number;
  readyItemsCount: number;
  notes: string;
};

export type PaymentEntry = {
  id: string;
  sessionId: string;
  accountId?: string | null;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
};

export type WaiterServiceChargeSettings = {
  enabled: boolean;
  percentage: number;
  taxWithholdPercent: number;
};

export type AccountTicket = {
  id: string;
  orderNumber?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

export type OrderItemOption = {
  id: string;
  orderItemId?: string;
  optionName: string;
  price: number;
  quantity: number;
};

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  groupName?: string;
  optionName?: string;
};

export type ProductVariationGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  options: ProductOption[];
};

export type Product = {
  id: string;
  categoryId: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  featured: boolean;
  sendToKds: boolean;
  variations: ProductVariationGroup[];
};

export type ProductCategory = {
  id: string;
  name: string;
  products: Product[];
};

export type OrderItem = {
  id: string;
  sessionId: string;
  accountId: string;
  orderId?: string | null;
  orderStatus?: string | null;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  status: OrderItemStatus;
  kitchenStatus: KitchenStatus;
  createdAt: string;
  sentAt?: string | null;
  options: OrderItemOption[];
};

export type TableAccount = {
  id: string;
  sessionId: string;
  name: string;
  notes: string;
  accountNumber: number;
  total: number;
  paidTotal: number;
  dueAmount: number;
  status: AccountStatus;
  kitchenStatus: KitchenStatus;
  itemCount: number;
  draftCount: number;
  sentCount: number;
  readyCount: number;
  deliveredCount: number;
  payments: PaymentEntry[];
  tickets: AccountTicket[];
  items: OrderItem[];
};

export type SessionHistoryEntry = {
  id: string;
  type: 'item' | 'payment' | 'status';
  label: string;
  timestamp: string;
  amount?: number;
};

export type TableSession = {
  id: string;
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  openedAt: string;
  closedAt?: string | null;
  guestCount: number;
  status: SessionStatus;
  notes: string;
  total: number;
  paidTotal: number;
  dueAmount: number;
  itemCount: number;
  sentItemsCount: number;
  readyItemsCount: number;
  accountCount: number;
  accounts: TableAccount[];
  history: SessionHistoryEntry[];
  tableChoices: WaiterTableChoice[];
  serviceChargeSettings?: WaiterServiceChargeSettings;
};

export type WaiterPaymentInput = {
  accountId: string;
  method: PaymentMethod;
  amount: number;
};

export type WaiterServiceChargeInput = {
  enabled: boolean;
  percentage?: number;
};

export type WaiterPixCheckout = {
  correlationID: string;
  brCode: string;
  qrCodeImage?: string;
  paymentLinkUrl?: string;
  paymentId?: string;
};

type CacheEnvelope<T> = {
  cachedAt: number;
  data: T;
};

const WAITER_WEB_SESSION_KEY = 'waiter_web_session';
const WAITER_WEB_TIMEOUT_MS = 15000;
const WAITER_BOOTSTRAP_CACHE_KEY = 'waiter_web_bootstrap_cache';
const WAITER_CATALOG_CACHE_KEY = 'waiter_web_catalog_cache';
const WAITER_SESSION_CACHE_PREFIX = 'waiter_web_session_cache:';

const normalizeCpf = (value: string) => value.replace(/\D/g, '');

const tryParseErrorPayload = (value: unknown) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return null;
};

const getErrorMessage = (error: any) => {
  const parsedError =
    tryParseErrorPayload(error) ||
    tryParseErrorPayload(error?.message) ||
    tryParseErrorPayload(error?.details) ||
    tryParseErrorPayload(error?.context);

  const nestedMessage =
    parsedError?.error ||
    parsedError?.message ||
    parsedError?.error_description ||
    parsedError?.details;

  return String(
    nestedMessage ||
      error?.message ||
      error?.error_description ||
      error?.details ||
      error?.description ||
      'Nao foi possivel concluir a operacao.',
  );
};

const extractFunctionErrorMessage = async (error: any) => {
  const context = error?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const text = await context.clone().text();
      const parsed = tryParseErrorPayload(text);
      if (parsed) {
        return getErrorMessage(parsed);
      }
      if (text?.trim()) {
        return text.trim();
      }
    } catch {}
  }

  return getErrorMessage(error);
};

const isTransportError = (error: unknown) => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('failed to send a request to the edge function') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('cors') ||
    message.includes('timeout') ||
    message.includes('abort')
  );
};

const isFunctionResponseError = (error: unknown) => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('non-2xx') ||
    message.includes('edge function returned') ||
    message.includes('functionshttperror')
  );
};

const isSessionAccessError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('sess') ||
    message.includes('expirada') ||
    message.includes('invalida') ||
    message.includes('inativo') ||
    message.includes('nao liberado')
  );
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = WAITER_WEB_TIMEOUT_MS,
  message = 'A conexao com o app do garcom demorou demais para responder.',
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function readCache<T>(key: string, maxAgeMs = 1000 * 60 * 30) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.cachedAt || !('data' in parsed)) return null;
    if (Date.now() - parsed.cachedAt > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    const payload: CacheEnvelope<T> = {
      cachedAt: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

function clearCache(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

async function invokeFunctionDirect<T>(name: string, body: Record<string, unknown>, token?: string) {
  const response = await withTimeout(
    fetch(`${SUPABASE_URL}/functions/v1/${name}/`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'boracume-waiter-web',
      },
      body: JSON.stringify(body),
    }),
  );

  const payload = await response
    .json()
    .catch(() => ({ error: `A funcao ${name} retornou uma resposta invalida.` }));

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  if ((payload as any)?.error) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>, token?: string) {
  const functionPath = name.endsWith('/') ? name : `${name}/`;

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke(functionPath, {
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    );

    if (error) {
      throw error;
    }

    if ((data as any)?.error) {
      throw new Error(getErrorMessage(data));
    }

    return data as T;
  } catch (error) {
    if (isFunctionResponseError(error)) {
      throw new Error(await extractFunctionErrorMessage(error));
    }

    if (!isTransportError(error)) {
      throw new Error(await extractFunctionErrorMessage(error));
    }

    return invokeFunctionDirect<T>(name, body, token);
  }
}

export const waiterWebSessionStorage = {
  load(): WaiterWebStoredSession | null {
    try {
      const raw = localStorage.getItem(WAITER_WEB_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WaiterWebStoredSession;
      if (!parsed?.token || !parsed?.profile?.id) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(session: WaiterWebStoredSession) {
    localStorage.setItem(WAITER_WEB_SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(WAITER_WEB_SESSION_KEY);
  },
};

function requireSession() {
  const session = waiterWebSessionStorage.load();
  if (!session?.token) {
    throw new Error('Sessao do garcom nao encontrada.');
  }
  return session;
}

function storeSessionSnapshot(sessionId: string, session: TableSession) {
  writeCache(`${WAITER_SESSION_CACHE_PREFIX}${sessionId}`, session);
}

export function loadWaiterBootstrapCache() {
  return readCache<{ profile: WaiterWebProfile; tables: RestaurantTable[] }>(WAITER_BOOTSTRAP_CACHE_KEY);
}

export function loadWaiterCatalogCache() {
  return readCache<{ categories: ProductCategory[] }>(WAITER_CATALOG_CACHE_KEY);
}

export function loadWaiterSessionCache(sessionId: string) {
  return readCache<TableSession>(`${WAITER_SESSION_CACHE_PREFIX}${sessionId}`);
}

export async function loginWaiterWeb(cpf: string, password: string) {
  const response = await invokeFunction<{ session: WaiterWebStoredSession }>('waiter-web-auth', {
    action: 'login',
    cpf: normalizeCpf(cpf),
    password,
  });

  waiterWebSessionStorage.save(response.session);
  return response.session;
}

export async function loadWaiterWebSession() {
  const session = waiterWebSessionStorage.load();
  if (!session) return null;

  try {
    const response = await invokeFunction<{ session: WaiterWebStoredSession }>(
      'waiter-web-auth',
      {
        action: 'me',
      },
      session.token,
    );
    waiterWebSessionStorage.save(response.session);
    return response.session;
  } catch (error) {
    if (isTransportError(error)) {
      return session;
    }

    if (isSessionAccessError(error)) {
      waiterWebSessionStorage.clear();
      return null;
    }

    return session;
  }
}

export async function logoutWaiterWeb() {
  const session = waiterWebSessionStorage.load();
  try {
    if (session?.token) {
      await invokeFunction('waiter-web-auth', { action: 'logout' }, session.token);
    }
  } catch {}

  waiterWebSessionStorage.clear();
  clearCache(WAITER_BOOTSTRAP_CACHE_KEY);
  clearCache(WAITER_CATALOG_CACHE_KEY);
}

export async function bootstrapWaiterWeb() {
  const session = requireSession();
  const response = await invokeFunction<{ profile: WaiterWebProfile; tables: RestaurantTable[] }>(
    'waiter-web',
    {
      action: 'bootstrap',
    },
    session.token,
  );

  writeCache(WAITER_BOOTSTRAP_CACHE_KEY, response);
  return response;
}

export async function createWaiterTable(input: {
  tableNumber: number;
  capacity: number;
  location?: string;
}) {
  const session = requireSession();
  return invokeFunction<{ table: WaiterTableChoice }>(
    'waiter-web',
    {
      action: 'create_table',
      ...input,
    },
    session.token,
  );
}

export async function openWaiterTableSession(tableId: string, tableNumber: number, guestCount: number) {
  const session = requireSession();
  return invokeFunction<{ sessionId: string }>(
    'waiter-web',
    {
      action: 'open_session',
      tableId,
      tableNumber,
      guestCount,
    },
    session.token,
  );
}

export async function getWaiterSessionDetails(sessionId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'session_details',
      sessionId,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function updateWaiterSessionNote(sessionId: string, notes: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'update_session_note',
      sessionId,
      notes,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function requestWaiterCheck(sessionId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'request_check',
      sessionId,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function releaseWaiterTable(sessionId: string) {
  const session = requireSession();
  clearCache(`${WAITER_SESSION_CACHE_PREFIX}${sessionId}`);
  return invokeFunction<{ ok: true }>(
    'waiter-web',
    {
      action: 'release_table',
      sessionId,
    },
    session.token,
  );
}

export async function transferWaiterTable(sessionId: string, targetTableId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'transfer_table',
      sessionId,
      targetTableId,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function createWaiterAccount(sessionId: string, name: string, notes = '') {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'create_account',
      sessionId,
      name,
      notes,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function renameWaiterAccount(accountId: string, name: string, notes = '') {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'rename_account',
      accountId,
      name,
      notes,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function removeWaiterAccount(accountId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'remove_account',
      accountId,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function mergeWaiterAccounts(sourceAccountId: string, targetAccountId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'merge_accounts',
      sourceAccountId,
      targetAccountId,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function transferWaiterAccount(accountId: string, targetTableId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession; transferredSessionId?: string }>(
    'waiter-web',
    {
      action: 'transfer_account',
      accountId,
      targetTableId,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function listWaiterCatalog() {
  const session = requireSession();
  const response = await invokeFunction<{ categories: ProductCategory[] }>(
    'waiter-web',
    {
      action: 'catalog',
    },
    session.token,
  );

  writeCache(WAITER_CATALOG_CACHE_KEY, response);
  return response;
}

export async function addWaiterItem(input: {
  sessionId: string;
  accountId: string;
  productId: string;
  quantity: number;
  notes: string;
  selectedOptions: ProductOption[];
}) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'add_item',
      ...input,
    },
    session.token,
  );

  storeSessionSnapshot(input.sessionId, response.session);
  return response;
}

export async function updateWaiterDraftItem(input: {
  itemId: string;
  quantity: number;
  notes: string;
  selectedOptions: ProductOption[];
}) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'update_draft_item',
      ...input,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function moveWaiterItem(input: {
  itemId: string;
  targetAccountId: string;
  quantity: number;
}) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'move_item',
      ...input,
    },
    session.token,
  );

  storeSessionSnapshot(response.session.id, response.session);
  return response;
}

export async function cancelWaiterDraftItem(itemId: string, accountId: string, sessionId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'cancel_draft_item',
      itemId,
      accountId,
      sessionId,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function sendWaiterAccountItems(sessionId: string, accountId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'send_account',
      sessionId,
      accountId,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function sendAllWaiterSessionItems(sessionId: string) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession; sentAccounts?: number }>(
    'waiter-web',
    {
      action: 'send_all_accounts',
      sessionId,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function recordWaiterPayments(sessionId: string, payments: WaiterPaymentInput[], serviceCharge?: WaiterServiceChargeInput) {
  const session = requireSession();
  const response = await invokeFunction<{ session: TableSession }>(
    'waiter-web',
    {
      action: 'record_payments',
      sessionId,
      payments,
      serviceCharge,
    },
    session.token,
  );

  storeSessionSnapshot(sessionId, response.session);
  return response;
}

export async function startWaiterPixCheckout(input: {
  sessionId: string;
  accountId: string;
  amount: number;
  accountName: string;
  tableLabel: string;
}) {
  const session = requireSession();
  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Informe um valor valido para gerar o PIX.');
  }

  const response = await invokeFunction<{
    ok?: boolean;
    error?: string;
    message?: string;
    correlationID?: string;
    brCode?: string;
    qrCodeImage?: string;
    paymentLinkUrl?: string;
    paymentId?: string;
  }>('pix-start-checkout', {
    restaurantUserId: session.profile.restaurantId,
    preferredMethod: 'pix',
    orderPayload: {
      source: 'WAITER_WEB_PIX',
      payment_method: 'pix',
      total: amount,
      delivery_fee: 0,
      order_type: 'dine_in',
      customer_name: input.accountName || input.tableLabel || 'Comanda',
      waiter_session_id: input.sessionId,
      waiter_account_id: input.accountId,
      waiter_id: session.profile.id,
      variations: {
        source: 'WAITER_WEB_PIX',
        waiter: {
          session_id: input.sessionId,
          account_id: input.accountId,
          account_name: input.accountName,
          table_label: input.tableLabel,
          waiter_id: session.profile.id,
        },
      },
    },
  });

  if (!response?.ok || !response?.correlationID || !response?.brCode) {
    throw new Error(
      getErrorMessage(response) || 'Nao foi possivel gerar o QR Code PIX para esta comanda.',
    );
  }

  return {
    correlationID: String(response.correlationID),
    brCode: String(response.brCode),
    qrCodeImage: response.qrCodeImage ? String(response.qrCodeImage) : undefined,
    paymentLinkUrl: response.paymentLinkUrl ? String(response.paymentLinkUrl) : undefined,
    paymentId: response.paymentId ? String(response.paymentId) : undefined,
  } as WaiterPixCheckout;
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function getSessionTotal(accounts: TableAccount[]) {
  return accounts.reduce((sum, account) => sum + Number(account.total || 0), 0);
}
