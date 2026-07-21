import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const STORAGE_KEY = 'popsystem_pending_store_invitation';

export default function StoreInvitation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accountUser, isLoading, refreshStores } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const token = useMemo(() => {
    const queryToken = new URLSearchParams(location.search).get('token') || '';
    if (queryToken) localStorage.setItem(STORAGE_KEY, queryToken);
    return queryToken || localStorage.getItem(STORAGE_KEY) || '';
  }, [location.search]);

  useEffect(() => {
    if (!accountUser || !token || accepted || accepting || error) return;
    const accept = async () => {
      setAccepting(true);
      const { data, error: invokeError } = await supabase.functions.invoke('store-network', {
        body: { action: 'accept', token },
      });
      if (invokeError || !data?.ok) {
        const messages: Record<string, string> = {
          invitation_email_mismatch: 'Este convite foi enviado para outro e-mail. Entre com o endereço que recebeu o convite.',
          invitation_expired: 'Este convite expirou. Solicite um novo convite ao proprietário da rede.',
          invitation_not_pending: 'Este convite já foi utilizado ou cancelado.',
          network_capacity_reached: 'A rede atingiu o limite de lojas contratado.',
          invalid_invitation: 'O convite é inválido ou não existe mais.',
        };
        setError(messages[data?.error] || data?.message || invokeError?.message || 'Não foi possível aceitar o convite.');
        setAccepting(false);
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      await refreshStores();
      setAccepted(true);
      setAccepting(false);
    };
    void accept();
  }, [accountUser, token, accepted, accepting, error, refreshStores]);

  if (isLoading || accepting) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F5F8F6]"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-[#087A55]" /><p className="mt-3 text-sm text-muted-foreground">Validando convite da unidade...</p></div></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F3FBF7] via-white to-[#FFF1E8] p-4">
      <Card className="w-full max-w-lg overflow-hidden border-[#B8D7CA] shadow-xl">
        <div className="h-2 bg-gradient-to-r from-[#003223] via-[#087A55] to-[#FF6400]" />
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7F0]"><Building2 className="h-7 w-7 text-[#087A55]" /></div>
          <CardTitle className="text-2xl text-[#003223]">Convite para uma unidade PopSystem</CardTitle>
          <CardDescription>Seu acesso ficará limitado à loja que convidou este e-mail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">O link não contém um convite válido.</p>}
          {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {accepted && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="mt-2 font-bold text-emerald-900">Unidade vinculada com sucesso</p><p className="mt-1 text-sm text-emerald-800">Agora você pode identificar seu operador e começar a configurar a loja.</p></div>}
          {!accountUser && token && <><div className="flex items-start gap-3 rounded-2xl border bg-white p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087A55]" /><p className="text-sm text-muted-foreground">Entre usando exatamente o e-mail que recebeu o convite. Se ainda não possui conta, use o botão de criação recebido por e-mail.</p></div><Button className="w-full bg-[#087A55] hover:bg-[#056843]" onClick={() => navigate('/login', { state: { from: { pathname: '/lojas/convite' } } })}><LogIn className="mr-2 h-4 w-4" />Entrar para aceitar</Button></>}
          {accepted && <Button className="w-full bg-[#FF6400] hover:bg-[#D95700]" onClick={() => navigate('/operator-login', { replace: true })}>Acessar minha unidade</Button>}
          {accountUser && error && <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>Voltar ao painel</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
