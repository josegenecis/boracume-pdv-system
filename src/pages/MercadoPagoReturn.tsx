import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { clearAllMenuCartStorage } from '@/hooks/useSimpleCart';

function useQueryParam(name: string) {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search).get(name), [location.search, name]);
}

export default function MercadoPagoReturn() {
  const navigate = useNavigate();
  const cid = useQueryParam('cid') || '';
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading');

  useEffect(() => {
    if (!cid) {
      setStatus('error');
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const { data }: any = await supabase.functions.invoke('pix-checkout-status', { body: { correlationID: cid } as any });
        if (!active) return;
        if (!data?.ok) {
          setStatus('error');
          return;
        }
        if (data.status === 'PAID' && data.orderId) {
          setStatus('paid');
          clearAllMenuCartStorage();
          navigate(`/track/${data.orderId}`, { replace: true });
          return;
        }
        setStatus('pending');
      } catch {
        if (active) setStatus('error');
      }
      setTimeout(poll, 3000);
    };

    poll();
    return () => { active = false; };
  }, [cid, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirmando pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando status do pagamento...
            </div>
          )}
          {status === 'pending' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pagamento ainda não confirmado. Aguardando...
            </div>
          )}
          {status === 'paid' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Pagamento confirmado. Redirecionando...
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Não foi possível confirmar o pagamento agora.
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

