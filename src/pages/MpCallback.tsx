import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function MpCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando conexão com Mercado Pago...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Você recusou a conexão ou ocorreu um erro no Mercado Pago.');
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado.');
      return;
    }

    if (!user) {
      // Se não estiver logado, salva o código no localStorage e manda logar
      // (Simplificado: assume que está logado pois iniciou o fluxo logado)
      setStatus('error');
      setMessage('Faça login novamente para concluir a conexão.');
      return;
    }

    const exchangeToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mp-oauth', {
          body: { code, userId: user.id }
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
            <button 
              onClick={() => navigate('/pix')}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Voltar
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
