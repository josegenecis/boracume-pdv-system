import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

export function PopPayCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Conectando sua conta ao PopPay...');

  useEffect(() => {
    const code = String(searchParams.get('code') || '');
    const state = String(searchParams.get('state') || '');
    const oauthError = String(searchParams.get('error') || '');
    if (oauthError) {
      setStatus('error');
      setMessage('A autorização do PopPay foi recusada ou cancelada.');
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('A resposta do Mercado Pago não contém os dados de autorização.');
      return;
    }
    let cancelled = false;
    let redirectTimer: number | undefined;
    void (async () => {
      const { data, status: httpStatus } = await invokeEdgeFunction('poppay-oauth', { code, state }, { timeoutMs: 60000 });
      if (cancelled) return;
      if (httpStatus >= 400 || !data?.ok) {
        setStatus('error');
        setMessage(String(data?.message || data?.error || 'Não foi possível conectar ao PopPay.'));
        return;
      }
      setStatus('success');
      setMessage('PopPay conectado. Se você iniciou pelo aplicativo desktop, já pode fechar esta página e voltar ao PopSystem.');
      redirectTimer = window.setTimeout(() => navigate('/pix'), 3500);
    })();
    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>Conexão PopPay</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'loading' ? <Loader2 className="h-12 w-12 animate-spin text-emerald-600" /> : null}
          {status === 'success' ? <CheckCircle className="h-12 w-12 text-emerald-600" /> : null}
          {status === 'error' ? <XCircle className="h-12 w-12 text-red-500" /> : null}
          <p className="text-base text-slate-700">{message}</p>
          {status === 'error' ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/pix')}>Voltar</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
