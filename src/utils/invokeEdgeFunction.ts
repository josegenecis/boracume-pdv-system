import { supabase } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async (
  functionName: string,
  body: unknown
): Promise<{ data: any | null; status: number }> => {
  console.log(`[EdgeFunction] Invoking ${functionName}...`);
  const startTime = Date.now();

  try {
    // Create a custom timeout signal (120 seconds)
    // This is much longer than the default 30s to allow for AI processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body, 
      // @ts-ignore - signal is supported by fetch but might not be in Supabase types
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[EdgeFunction] ${functionName} finished in ${duration}s`);

    if (error) {
       console.error('[EdgeFunction] Supabase Client Error:', error);
       
       // Handle AbortError (Timeout)
       if (error.name === 'AbortError' || (error instanceof Error && error.message.includes('aborted'))) {
           throw new Error('A requisição demorou muito e foi cancelada (Timeout 120s).');
       }

       // Se o erro for de conexão/network, throw para cair no catch do componente e mostrar "Erro de Rede"
       if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw error;
       }
       
       // Se for erro da função (500), retornamos o erro estruturado
       // Tenta extrair JSON do erro se possível
       let errorData = { error: error.message || error };
       try {
           if (typeof error === 'string') {
               const parsed = JSON.parse(error);
               errorData = parsed;
           }
       } catch {}

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
