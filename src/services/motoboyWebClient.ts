import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';

export type MotoboyProfile = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate?: string | null;
  status?: string;
};

export type MotoboySession = { token: string; expiresAt: string; profile: MotoboyProfile };

export type MotoboyOrder = {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_address_reference?: string | null;
  customer_neighborhood?: string | null;
  customer_latitude?: number | null;
  customer_longitude?: number | null;
  delivery_instructions?: string | null;
  payment_method?: string;
  total?: number;
  delivery_fee?: number | null;
  status?: string;
  created_at?: string;
};

export type DeliveryOffer = {
  id: string;
  payout_amount: number;
  expires_at: string;
  created_at: string;
  target_driver_id?: string | null;
  order: MotoboyOrder;
};

export type DeliveryAssignment = {
  id: string;
  status: 'accepted' | 'arrived' | 'picked_up' | 'delivered' | 'cancelled';
  route_position: number;
  payout_amount: number;
  accepted_at: string;
  order: MotoboyOrder;
};

export type DeliveryCancellation = {
  id: string;
  source: 'assignment' | 'offer';
  status: 'cancelled';
  updated_at: string;
  order: MotoboyOrder;
};

export type MotoboyBootstrap = {
  profile: MotoboyProfile;
  restaurant?: { restaurant_name?: string; address?: string; logo_url?: string } | null;
  offers: DeliveryOffer[];
  assignments: DeliveryAssignment[];
  cancellations: DeliveryCancellation[];
  balance: { pending: number; settled: number };
};

const SESSION_KEY = 'popsystem_motoboy_session';

export const normalizeMotoboyCpf = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 11);

export const formatMotoboyCpf = (value: string) => {
  const digits = normalizeMotoboyCpf(value);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export const isValidMotoboyCpf = (value: string) => {
  const cpf = normalizeMotoboyCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
};

async function invoke<T>(functionName: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(String(payload?.error || 'Não foi possível concluir a operação.'));
  return payload as T;
}

export const motoboySessionStorage = {
  load(): MotoboySession | null {
    try {
      const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return parsed?.token ? parsed : null;
    } catch { return null; }
  },
  save(session: MotoboySession) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clear() { localStorage.removeItem(SESSION_KEY); },
};

const token = () => {
  const session = motoboySessionStorage.load();
  if (!session?.token) throw new Error('Sessão do motoboy não encontrada.');
  return session.token;
};

export async function loginMotoboy(cpf: string, password: string) {
  const normalizedCpf = normalizeMotoboyCpf(cpf);
  const result = await invoke<{ session: MotoboySession }>('motoboy-web-auth', {
    action: 'login',
    cpf: normalizedCpf,
    // Mantido durante a transição para versões anteriores da Edge Function.
    login: normalizedCpf,
    password,
  });
  motoboySessionStorage.save(result.session);
  return result.session;
}

export async function loadMotoboySession() {
  const session = motoboySessionStorage.load();
  if (!session) return null;
  try {
    const result = await invoke<{ session: MotoboySession }>('motoboy-web-auth', { action: 'me' }, session.token);
    motoboySessionStorage.save(result.session);
    return result.session;
  } catch {
    motoboySessionStorage.clear();
    return null;
  }
}

export async function logoutMotoboy() {
  const session = motoboySessionStorage.load();
  try { if (session) await invoke('motoboy-web-auth', { action: 'logout' }, session.token); } catch { /* sessão local será encerrada mesmo sem rede */ }
  motoboySessionStorage.clear();
}

export const loadMotoboyBootstrap = () => invoke<MotoboyBootstrap>('motoboy-web', { action: 'bootstrap' }, token());
export const setMotoboyAvailability = (online: boolean) => invoke('motoboy-web', { action: 'availability', online }, token());
export const acceptDeliveryOffer = (offerId: string) => invoke('motoboy-web', { action: 'accept_offer', offerId }, token());
export const reorderDeliveries = (assignmentIds: string[]) => invoke('motoboy-web', { action: 'reorder', assignmentIds }, token());
export const updateDeliveryStage = (assignmentId: string, status: string) => invoke('motoboy-web', { action: 'update_status', assignmentId, status }, token());
export const sendDriverLocation = (assignmentId: string, coords: GeolocationCoordinates) => invoke('motoboy-web', {
  action: 'location', assignmentId, latitude: coords.latitude, longitude: coords.longitude,
  accuracy: coords.accuracy, heading: coords.heading, speed: coords.speed,
}, token());
