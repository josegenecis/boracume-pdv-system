import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCache, writeCache } from '../lib/cache';
import { supabase } from '../lib/supabase';
import type {
  AddItemInput,
  OperatorProfile,
  PaymentMethod,
  ProductCategory,
  RestaurantTable,
  TableAccount,
  TableSession,
  WaiterStoredSession,
} from '../types/domain';

const WAITER_MOBILE_SESSION_KEY = 'waiter_mobile_session';

type WaiterFunctionName = 'waiter-web' | 'waiter-web-auth';

type WaiterProfilePayload = Partial<OperatorProfile> & {
  cpf?: string;
  permissions?: Record<string, boolean> | null;
};

function normalizeCpf(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function normalizeOperatorProfile(profile: WaiterProfilePayload): OperatorProfile {
  return {
    id: String(profile.id || ''),
    restaurantId: String(profile.restaurantId || ''),
    name: String(profile.name || 'Garcom'),
    cpf: normalizeCpf(String(profile.cpf || '')),
    email: String(profile.email || ''),
    role: String(profile.role || 'cashier'),
    permissions: profile.permissions && typeof profile.permissions === 'object' ? profile.permissions : {},
  };
}

function normalizeStoredSession(value: Partial<WaiterStoredSession>): WaiterStoredSession {
  return {
    token: String(value.token || ''),
    expiresAt: String(value.expiresAt || ''),
    profile: normalizeOperatorProfile(value.profile || {}),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const candidates = [value.message, value.error, value.error_description, value.details];
    const message = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Nao foi possivel concluir a operacao do app do garcom.';
}

async function invokeWaiterFunction<T>(
  name: WaiterFunctionName,
  body: Record<string, unknown>,
  token?: string,
) {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(getErrorMessage(data));
  }

  return data as T;
}

async function loadStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(WAITER_MOBILE_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<WaiterStoredSession>;
    const session = normalizeStoredSession(parsed);
    if (!session.token || !session.profile.id || !session.profile.restaurantId) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

async function saveStoredSession(session: WaiterStoredSession) {
  await AsyncStorage.setItem(WAITER_MOBILE_SESSION_KEY, JSON.stringify(session));
}

async function clearStoredSession() {
  await AsyncStorage.removeItem(WAITER_MOBILE_SESSION_KEY);
}

async function requireStoredSession() {
  const session = await loadStoredSession();
  if (!session?.token) {
    throw new Error('Sessao do garcom nao encontrada.');
  }
  return session;
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export async function restoreWaiterSession() {
  const stored = await loadStoredSession();
  if (!stored) {
    return null;
  }

  try {
    const response = await invokeWaiterFunction<{ session: WaiterStoredSession }>(
      'waiter-web-auth',
      { action: 'me' },
      stored.token,
    );
    const session = normalizeStoredSession(response.session);
    await saveStoredSession(session);
    return session;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function signInWaiter(cpf: string, password: string) {
  const response = await invokeWaiterFunction<{ session: WaiterStoredSession }>('waiter-web-auth', {
    action: 'login',
    cpf: normalizeCpf(cpf),
    password,
  });
  const session = normalizeStoredSession(response.session);
  await saveStoredSession(session);
  return session;
}

export async function signOutWaiter() {
  const stored = await loadStoredSession();
  try {
    if (stored?.token) {
      await invokeWaiterFunction('waiter-web-auth', { action: 'logout' }, stored.token);
    }
  } catch {
    // Best effort logout. We still clear the local session below.
  } finally {
    await clearStoredSession();
  }
}

export async function listRestaurantTables(restaurantId: string) {
  try {
    const session = await requireStoredSession();
    const response = await invokeWaiterFunction<{ profile: WaiterProfilePayload; tables: RestaurantTable[] }>(
      'waiter-web',
      { action: 'bootstrap' },
      session.token,
    );

    if (response.profile) {
      await saveStoredSession({
        ...session,
        profile: normalizeOperatorProfile(response.profile),
      });
    }

    const tables = response.tables ?? [];
    await writeCache(`tables:${session.profile.restaurantId}`, tables);
    return tables;
  } catch (error) {
    const cached = await readCache<RestaurantTable[]>(`tables:${restaurantId}`);
    if (cached) {
      return cached;
    }
    throw new Error(getErrorMessage(error));
  }
}

export async function getSessionDetails(sessionId: string) {
  try {
    const session = await requireStoredSession();
    const response = await invokeWaiterFunction<{ session: TableSession }>(
      'waiter-web',
      {
        action: 'session_details',
        sessionId,
      },
      session.token,
    );

    await writeCache(`session:${sessionId}`, response.session);
    return response.session;
  } catch (error) {
    const cached = await readCache<TableSession>(`session:${sessionId}`);
    if (cached) {
      return cached;
    }
    throw new Error(getErrorMessage(error));
  }
}

export async function openTableSession(input: {
  tableId: string;
  tableNumber: number;
  guestCount: number;
  operator: OperatorProfile;
}) {
  const session = await requireStoredSession();
  const response = await invokeWaiterFunction<{ sessionId: string }>(
    'waiter-web',
    {
      action: 'open_session',
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      guestCount: input.guestCount,
    },
    session.token,
  );

  return response.sessionId;
}

export async function createAccount(
  sessionId: string,
  _restaurantId: string,
  name: string,
  _operatorId: string,
) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'create_account',
      sessionId,
      name,
    },
    session.token,
  );
}

export async function renameAccount(accountId: string, name: string) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'rename_account',
      accountId,
      name,
    },
    session.token,
  );
}

export async function removeEmptyAccount(accountId: string) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'remove_account',
      accountId,
    },
    session.token,
  );
}

export async function listCatalog(restaurantId: string) {
  try {
    const session = await requireStoredSession();
    const response = await invokeWaiterFunction<{ categories: ProductCategory[] }>(
      'waiter-web',
      { action: 'catalog' },
      session.token,
    );

    const categories = response.categories ?? [];
    await writeCache(`catalog:${session.profile.restaurantId}`, categories);
    return categories;
  } catch (error) {
    const cached = await readCache<ProductCategory[]>(`catalog:${restaurantId}`);
    if (cached) {
      return cached;
    }
    throw new Error(getErrorMessage(error));
  }
}

export async function addItemToAccount(input: AddItemInput) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'add_item',
      sessionId: input.sessionId,
      accountId: input.accountId,
      productId: input.product.id,
      quantity: input.quantity,
      notes: input.notes,
      selectedOptions: input.selectedOptions,
    },
    session.token,
  );
}

export async function cancelDraftItem(itemId: string, accountId: string, sessionId: string) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'cancel_draft_item',
      itemId,
      accountId,
      sessionId,
    },
    session.token,
  );
}

export async function sendAccountItems(sessionId: string, account: TableAccount, _operator: OperatorProfile) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'send_account',
      sessionId,
      accountId: account.id,
    },
    session.token,
  );
}

export async function recordPayment(
  sessionId: string,
  accountId: string | null,
  amount: number,
  method: PaymentMethod,
  _operator: OperatorProfile,
) {
  const session = await requireStoredSession();
  await invokeWaiterFunction(
    'waiter-web',
    {
      action: 'record_payment',
      sessionId,
      accountId,
      amount,
      method,
    },
    session.token,
  );
}

export async function listenRestaurantRealtime(_restaurantId: string, _onChange: () => void) {
  return () => undefined;
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
