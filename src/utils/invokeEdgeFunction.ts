import { supabase } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async (
  functionName: string,
  body: unknown,
  options?: { timeoutMs?: number }
): Promise<{ data: any | null; status: number }> => {
  console.log(`[EdgeFunction] Invoking ${functionName}...`);
  const startTime = Date.now();

  try {
    const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? 120000) || 120000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const invokePromise = supabase.functions.invoke(functionName, {
      body: body,
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
