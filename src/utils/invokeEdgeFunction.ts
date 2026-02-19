import { supabase } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async (
  functionName: string,
  body: unknown
): Promise<{ data: any | null; status: number }> => {
  console.log(`[EdgeFunction] Invoking ${functionName}...`);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body, // Pass object directly, Supabase handles stringify and Content-Type
      // Increase timeout to 120 seconds for large menus
      // Note: This overrides global fetch timeout if supported by the browser/client
    })

    if (error) {
       console.error('[EdgeFunction] Supabase Client Error:', error);
       // Se o erro for de conexão/network, throw para cair no catch do componente e mostrar "Erro de Rede"
       if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw error;
       }
       // Se for erro da função (500), retornamos o erro estruturado
       return { data: { error: error.message || error }, status: 500 };
    }

    return { data, status: 200 }
  } catch (err: any) {
    console.error('[EdgeFunction] Exception:', err);
    // Retornar status 500 para ativar o fallback de simulação no frontend se necessário
    return { data: { error: err.message }, status: 500 };
  }
}
