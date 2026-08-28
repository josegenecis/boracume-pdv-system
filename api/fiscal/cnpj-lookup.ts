import { createClient } from '@supabase/supabase-js';
import { getSupabaseRuntimeEnv } from '../_lib/runtime-env.js';
import {
  isValidCnpj,
  normalizeBrasilApi,
  normalizeCnpjWs,
  type CnpjRegistrationData,
} from '../_lib/cnpj-registration.js';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseRuntimeEnv();

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(payload: unknown): unknown;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error || '');

const fetchJson = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PopSystem/1.0 (fiscal onboarding; contato@popsystem.com.br)',
    },
  });
  if (!response.ok) throw new Error(`Consulta cadastral indisponível (${response.status}).`);
  return response.json();
};

async function lookupRegistration(cnpj: string, signal: AbortSignal): Promise<CnpjRegistrationData> {
  try {
    const data = await fetchJson(`https://publica.cnpj.ws/cnpj/${cnpj}`, signal);
    const normalized = normalizeCnpjWs(data, cnpj);
    if (normalized) return normalized;
  } catch (error) {
    console.warn('[fiscal-cnpj-lookup] CNPJ.ws unavailable, using fallback', error);
  }

  const data = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, signal);
  const normalized = normalizeBrasilApi(data, cnpj);
  if (!normalized) throw new Error('A fonte cadastral retornou dados de outro CNPJ.');
  return normalized;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return res.status(401).json({ success: false, error: 'Sessão não confirmada.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return res.status(401).json({ success: false, error: 'Sessão expirada. Entre novamente.' });
  }

  const cnpj = String(req.query?.cnpj || '').replace(/\D/g, '');
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ success: false, error: 'CNPJ inválido no certificado.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const registration = await lookupRegistration(cnpj, controller.signal);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json({ success: true, registration });
  } catch (error: unknown) {
    console.error('[fiscal-cnpj-lookup] lookup failed', { cnpj, message: errorMessage(error) });
    return res.status(502).json({
      success: false,
      error: error instanceof Error && error.name === 'AbortError'
        ? 'A consulta do CNPJ demorou além do esperado. Tente novamente.'
        : 'Não foi possível consultar os dados públicos deste CNPJ agora.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
