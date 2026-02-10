import { supabase } from '@/integrations/supabase/client'

export const invokeEdgeFunction = async <T = any>(
  functionName: string,
  body: unknown
): Promise<{ data: T | null; status: number }> => {
  const baseUrl: string =
    (supabase as any).supabaseUrl ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    ''

  const anonKey: string =
    (supabase as any).supabaseKey ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    ''

  const url = `${String(baseUrl).replace(/\/+$/, '')}/functions/v1/${functionName}`

  let token = ''
  try {
    const { data } = await supabase.auth.getSession()
    token = data?.session?.access_token || ''
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (anonKey) headers.apikey = anonKey
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(30000) : undefined,
  })

  const text = await res.text()
  let json: T | null = null
  if (text) {
    try {
      json = JSON.parse(text) as T
    } catch {
      json = null
    }
  }
  return { data: json, status: res.status }
}
