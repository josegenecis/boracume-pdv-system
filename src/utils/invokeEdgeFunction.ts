import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async (
  functionName: string,
  body: unknown,
  options?: { timeoutMs?: number; authToken?: string | null }
): Promise<{ data: any | null; status: number }> => {
  const functionPath = functionName.replace(/^\/+|\/+$/g, '');
  
  console.log(`[EdgeFunction] Invoking ${functionPath}...`);
  const startTime = Date.now();

  try {
    let authToken = String(options?.authToken || '').trim();
    let authFailure = '';
    try {
      if (!authToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) authFailure = sessionError.message;
        let session = sessionData?.session || null;
        const expiresAtMs = Number(session?.expires_at || 0) * 1000;

        if (!session?.access_token || (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000)) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.error) authFailure = refreshed.error.message;
          session = refreshed.data?.session || session;
        }

        authToken = String(session?.access_token || '').trim();
      }
    } catch (error: any) {
      authFailure = String(error?.message || error || '');
    }

    if (!authToken) {
      console.warn(`[EdgeFunction] ${functionPath} sem sessão autenticada:`, authFailure || 'token ausente');
      return {
        data: { error: 'Sua sessão expirou. Entre novamente para continuar.' },
        status: 401,
      };
    }

    const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? 120000) || 120000);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;

    const activeStoreId = typeof window !== 'undefined' ? String(localStorage.getItem('popsystem_active_store_id') || '') : '';
    const requestBody = body && typeof body === 'object' && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>), _storeId: activeStoreId || undefined }
      : body;
    const invokeWithToken = (token: string) =>
      fetch(`${SUPABASE_URL}/functions/v1/${functionPath}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client-Info': 'boracume-app',
        },
        body: JSON.stringify(requestBody ?? {}),
        signal: controller.signal,
      }).then(async (response) => {
        const text = await response.text();
        let parsed: any = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = { error: text || `HTTP ${response.status}` };
        }
        return {
          data: parsed,
          error: response.ok ? null : { message: parsed?.error || parsed?.message || `HTTP ${response.status}` },
          status: response.status,
        };
      });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
        reject(new Error('Timeout'));
      }, timeoutMs);
    }) as Promise<any>;

    let result = await Promise.race([invokeWithToken(authToken), timeoutPromise]);
    const returnedUnauthorized =
      result?.status === 401 ||
      String(result?.data?.error || '').trim().toLowerCase() === 'unauthorized';

    if (returnedUnauthorized) {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = String(refreshed.data?.session?.access_token || '').trim();
      if (refreshed.error || !refreshedToken) {
        clearTimeout(timeoutId);
        return {
          data: { error: 'Sua sessão expirou. Entre novamente para continuar.' },
          status: 401,
        };
      }
      authToken = refreshedToken;
      result = await Promise.race([invokeWithToken(authToken), timeoutPromise]);
    }

    clearTimeout(timeoutId);
    const { data, error, status } = result;
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[EdgeFunction] ${functionName} finished in ${duration}s`);

    if (error) {
       console.error('[EdgeFunction] Supabase Client Error:', error);
       
       if (error.name === 'AbortError' || (error instanceof Error && error.message.includes('aborted'))) {
           throw new Error('A requisição demorou muito e foi cancelada (Timeout 120s).');
       }
       if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw error;
       }
       
       let detailed = typeof error === 'string' ? error : (error.message || 'Erro desconhecido');
       const ctx: any = (error as any)?.context;
       const bodyText: string | undefined = typeof ctx?.body === 'string' ? ctx.body : undefined;
       if (bodyText) {
         try {
           const parsed = JSON.parse(bodyText);
           detailed = String(parsed?.error || parsed?.message || detailed);
         } catch {
           detailed = bodyText;
         }
       }
       const errorData = { error: detailed };
       return { data: errorData, status: status || 500 };
    }

    return { data, status: status || 200 }
  } catch (err: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`[EdgeFunction] Exception after ${duration}s:`, err);
    
    // Check if it was our timeout
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        return { data: { error: 'O servidor demorou muito para responder (Timeout). Tente novamente.' }, status: 504 };
    }

    // Retornar status 500 para ativar o fallback de simulação no frontend se necessário
    return { data: { error: err.message }, status: 500 };
  }
}
