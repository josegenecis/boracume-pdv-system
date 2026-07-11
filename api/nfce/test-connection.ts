const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://auth.popsystem.com.br';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImdjZnl yY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE'.replace(' ', '');

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, motivo: 'Método não permitido.' });
  }

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, motivo: 'Login não confirmado para testar a SEFAZ.' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/nfce-operations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ operation: 'testar_conexao' }),
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data || { success: false, motivo: 'Resposta fiscal inválida.' });
  } catch (error: any) {
    return res.status(502).json({
      success: false,
      motivo: error?.message || 'Não foi possível acessar o motor fiscal.',
    });
  }
}
