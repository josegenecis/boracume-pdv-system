import { supabase } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async (
  functionName: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<{ data: any | null; status: number }> => {
  // GARANTIR TRAILING SLASH PARA EVITAR REDIRECIONAMENTO 307 DO SUPABASE (CAUSA ERRO CORS)
  const functionPath = functionName.endsWith('/') ? functionName : `${functionName}/`;
  
  console.log(`[EdgeFunction] Invoking ${functionPath}...`);
  const startTime = Date.now();

  try {
    let authHeaders: Record<string, string> = {};
    try {
      let { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData?.session || null;
      const expiresAtMs = Number(session?.expires_at || 0) * 1000;

      if (!session?.access_token || (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000)) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data?.session || session;
      }

      if (session?.access_token) {
        authHeaders = { Authorization: `Bearer ${session.access_token}` };
      }
    } catch {}

    const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? 120000) || 120000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const invokePromise = supabase.functions.invoke(functionPath, {
      body: body,
      headers: authHeaders,
      // @ts-ignore
      signal: controller.signal
    });

    const { data, error } = await Promise.race([
      invokePromise,
      new Promise((_, reject) =>
        setTimeout(() => {
          try {
            controller.abort();
          } catch {}
          reject(new Error('Timeout'));
        }, timeoutMs)
      ) as any
    ]);

    clearTimeout(timeoutId);
    
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
       return { data: errorData, status: 500 };
    }

    return { data, status: 200 }
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
