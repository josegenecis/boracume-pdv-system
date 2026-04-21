import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';

export type TableStatus = 'free' | 'occupied' | 'serving' | 'payment_pending';
export type SessionStatus = 'open' | 'serving' | 'payment_pending' | 'closed';
export type AccountStatus = 'open' | 'paid';
export type OrderItemStatus = 'draft' | 'sent' | 'cancelled';
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

export type RestaurantTable = {
  id: string;
  number: number;
  capacity: number;
  location?: string | null;
  status: TableStatus;
  total: number;
  openMinutes: number;
  sessionId?: string | null;
};

export type TableSession = {
  id: string;
  tableId: string;
  tableNumber: number;
  openedAt: string;
  closedAt?: string | null;
  guestCount: number;
  status: SessionStatus;
  accounts: TableAccount[];
  history: SessionHistoryEntry[];
};

export type TableAccount = {
  id: string;
  sessionId: string;
  name: string;
  total: number;
  status: AccountStatus;
  itemCount: number;
  items: OrderItem[];
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
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  status: OrderItemStatus;
  createdAt: string;
  sentAt?: string | null;
  options: OrderItemOption[];
};

export type SessionHistoryEntry = {
  id: string;
  type: 'item' | 'payment' | 'status';
  label: string;
  timestamp: string;
  amount?: number;
};

const WAITER_WEB_SESSION_KEY = 'waiter_web_session';
const WAITER_WEB_TIMEOUT_MS = 15000;

const normalizeCpf = (value: string) => value.replace(/\D/g, '');

const getErrorMessage = (error: any) =>
  String(error?.message || error?.error_description || error?.details || 'Não foi possível concluir a operação.');

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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = WAITER_WEB_TIMEOUT_MS,
  message = 'A conexão com o app do garçom demorou demais para responder.',
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
    .catch(() => ({ error: `A função ${name} retornou uma resposta inválida.` }));

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

    if (data?.error) {
      throw new Error(getErrorMessage(data));
    }

    return data as T;
  } catch (error) {
    if (!isTransportError(error)) {
      throw new Error(getErrorMessage(error));
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
    const response = await invokeFunction<{ session: WaiterWebStoredSession }>('waiter-web-auth', {
      action: 'me',
    }, session.token);
    waiterWebSessionStorage.save(response.session);
    return response.session;
  } catch {
    waiterWebSessionStorage.clear();
    return null;
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
}

function requireSession() {
  const session = waiterWebSessionStorage.load();
  if (!session?.token) {
    throw new Error('Sessão do garçom não encontrada.');
  }
  return session;
}

export async function bootstrapWaiterWeb() {
  const session = requireSession();
  return invokeFunction<{ profile: WaiterWebProfile; tables: RestaurantTable[] }>('waiter-web', {
    action: 'bootstrap',
  }, session.token);
}

export async function openWaiterTableSession(tableId: string, tableNumber: number, guestCount: number) {
  const session = requireSession();
  return invokeFunction<{ sessionId: string }>('waiter-web', {
    action: 'open_session',
    tableId,
    tableNumber,
    guestCount,
  }, session.token);
}

export async function getWaiterSessionDetails(sessionId: string) {
  const session = requireSession();
  return invokeFunction<{ session: TableSession }>('waiter-web', {
    action: 'session_details',
    sessionId,
  }, session.token);
}

export async function createWaiterAccount(sessionId: string, name: string) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'create_account',
    sessionId,
    name,
  }, session.token);
}

export async function renameWaiterAccount(accountId: string, name: string) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'rename_account',
    accountId,
    name,
  }, session.token);
}

export async function removeWaiterAccount(accountId: string) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'remove_account',
    accountId,
  }, session.token);
}

export async function listWaiterCatalog() {
  const session = requireSession();
  return invokeFunction<{ categories: ProductCategory[] }>('waiter-web', {
    action: 'catalog',
  }, session.token);
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
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'add_item',
    ...input,
  }, session.token);
}

export async function cancelWaiterDraftItem(itemId: string, accountId: string, sessionId: string) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'cancel_draft_item',
    itemId,
    accountId,
    sessionId,
  }, session.token);
}

export async function sendWaiterAccountItems(sessionId: string, accountId: string) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'send_account',
    sessionId,
    accountId,
  }, session.token);
}

export async function recordWaiterPayment(sessionId: string, accountId: string | null, amount: number, method: PaymentMethod) {
  const session = requireSession();
  return invokeFunction<{ ok: true }>('waiter-web', {
    action: 'record_payment',
    sessionId,
    accountId,
    amount,
    method,
  }, session.token);
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
