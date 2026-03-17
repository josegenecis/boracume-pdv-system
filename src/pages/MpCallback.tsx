import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function MpCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando conexão com Mercado Pago...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Você recusou a conexão ou ocorreu um erro no Mercado Pago.');
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Parâmetros de autorização não encontrados.');
      return;
    }

    if (!user) {
      try {
        localStorage.setItem('mp_oauth_pending', JSON.stringify({ code, state }));
      } catch {}
      setStatus('error');
      setMessage('Faça login para concluir a conexão.');
      return;
    }

    const exchangeToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mp-oauth', {
          body: { code, state }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.message || data.error);

        setStatus('success');
        setMessage('Conexão realizada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/pix'), 2000);
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMessage('Erro ao conectar: ' + (e.message || 'Erro interno'));
      }
    };

    exchangeToken();
  }, [searchParams, user, navigate]);

  useEffect(() => {
    const tryResume = async () => {
      if (!user) return;
      try {
        const raw = localStorage.getItem('mp_oauth_pending') || '';
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const code = String(parsed?.code || '');
        const state = String(parsed?.state || '');
        if (!code || !state) return;
        localStorage.removeItem('mp_oauth_pending');
        setStatus('loading');
        setMessage('Processando conexão com Mercado Pago...');
        const { data, error } = await supabase.functions.invoke('mp-oauth', { body: { code, state } });
        if (error) throw error;
        if (data?.error) throw new Error(data.message || data.error);
        setStatus('success');
        setMessage('Conexão realizada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/pix'), 1500);
      } catch (e: any) {
        setStatus('error');
        setMessage('Erro ao conectar: ' + (e.message || 'Erro interno'));
      }
    };
    void tryResume();
  }, [user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Conectando Mercado Pago</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin text-blue-500" />}
          {status === 'success' && <CheckCircle className="h-12 w-12 text-green-500" />}
          {status === 'error' && <XCircle className="h-12 w-12 text-red-500" />}
          
          <p className="text-lg">{message}</p>
          
          {status === 'error' && (
            <div className="flex gap-2">
              {!user ? (
                <button
                  onClick={() => navigate('/login', { state: { from: { pathname: location.pathname + location.search } } })}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Fazer login
                </button>
              ) : null}
              <button
                onClick={() => navigate('/pix')}
                className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Voltar
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
