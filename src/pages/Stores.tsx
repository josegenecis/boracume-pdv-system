import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Copy, Loader2, Mail, Network, Plus, RefreshCw, RotateCw, Store, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type ManagedStore = {
  store_user_id: string;
  store_name: string;
  store_email: string | null;
  is_primary: boolean;
  status: 'active' | 'suspended';
};

type Invitation = {
  id: string;
  email: string;
  store_name: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type Summary = {
  store_user_id: string;
  store_name: string;
  order_count: number;
  gross_sales: number;
  average_ticket: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Stores() {
  const navigate = useNavigate();
  const { accountUser, subscription, stores, canManageStores, refreshStores, switchStore } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [managedStores, setManagedStores] = useState<ManagedStore[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [resendingInvitationId, setResendingInvitationId] = useState('');

  const isActiveMulti = String(subscription?.status || '').toLowerCase() === 'active' && Number(subscription?.plan_id || 0) >= 3;
  const capacity = Math.max(1, Number(subscription?.store_count || 1));
  const networkId = stores.find((store) => store.network_id)?.network_id || null;
  const occupiedSlots = managedStores.filter((store) => store.status === 'active').length
    + invitations.filter((invitation) => invitation.status === 'pending' && new Date(invitation.expires_at).getTime() > Date.now()).length;

  const totals = useMemo(() => summary.reduce((result, row) => ({
    orders: result.orders + Number(row.order_count || 0),
    sales: result.sales + Number(row.gross_sales || 0),
  }), { orders: 0, sales: 0 }), [summary]);

  const loadNetwork = useCallback(async () => {
    setLoading(true);
    try {
      const currentNetworkId = stores.find((store) => store.network_id)?.network_id;
      if (!currentNetworkId) {
        setManagedStores([]);
        setInvitations([]);
        setSummary([]);
        return;
      }
      const [storesResult, invitationResult, summaryResult] = await Promise.all([
        (supabase as any).from('store_network_stores').select('store_user_id,store_name,store_email,is_primary,status')
          .eq('network_id', currentNetworkId).order('is_primary', { ascending: false }).order('store_name'),
        (supabase as any).from('store_network_invitations').select('id,email,store_name,status,expires_at,created_at')
          .eq('network_id', currentNetworkId).order('created_at', { ascending: false }),
        (supabase as any).rpc('get_my_network_summary', { p_start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() }),
      ]);
      if (storesResult.error) throw storesResult.error;
      if (invitationResult.error) throw invitationResult.error;
      setManagedStores(storesResult.data || []);
      setInvitations(invitationResult.data || []);
      setSummary(summaryResult.error ? [] : (summaryResult.data || []));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a rede.');
    } finally {
      setLoading(false);
    }
  }, [stores]);

  useEffect(() => { void loadNetwork(); }, [loadNetwork]);

  const ensureNetwork = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('store-network', { body: { action: 'ensure' } });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Não foi possível criar a rede.');
      await refreshStores();
      toast.success('Estrutura multilojas ativada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ativar o Multi.');
    } finally {
      setCreating(false);
    }
  };

  const inviteStore = async () => {
    if (!storeName.trim() || !storeEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('store-network', {
        body: { action: 'invite', storeName: storeName.trim(), email: storeEmail.trim().toLowerCase() },
      });
      if (error || !data?.ok) {
        const messages: Record<string, string> = {
          network_capacity_reached: 'Todas as lojas contratadas já estão ocupadas ou possuem convite pendente.',
          multi_plan_required: 'É necessário ter uma assinatura Multi ativa.',
          email_is_primary_store: 'Use um e-mail diferente do acesso da loja principal.',
        };
        throw new Error(messages[data?.error] || data?.message || error?.message || 'Não foi possível convidar a loja.');
      }
      setLastInviteUrl(String(data.invitationUrl || ''));
      setStoreName('');
      setStoreEmail('');
      toast.success(data.emailNotice || 'Convite criado.');
      await loadNetwork();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o convite.');
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = async () => {
    if (!lastInviteUrl) return;
    await navigator.clipboard.writeText(lastInviteUrl);
    toast.success('Link do convite copiado.');
  };

  const resendInvitation = async (invitation: Invitation) => {
    setResendingInvitationId(invitation.id);
    try {
      const { data, error } = await supabase.functions.invoke('store-network', {
        body: { action: 'invite', storeName: invitation.store_name, email: invitation.email },
      });
      if (error || !data?.ok) throw new Error(data?.message || data?.error || error?.message || 'Não foi possível reenviar o convite.');
      setLastInviteUrl(String(data.invitationUrl || ''));
      toast.success(data.emailNotice || 'Novo convite criado.');
      await loadNetwork();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível reenviar o convite.');
    } finally {
      setResendingInvitationId('');
    }
  };

  const setStoreStatus = async (store: ManagedStore) => {
    const nextStatus = store.status === 'active' ? 'suspended' : 'active';
    const { data, error } = await supabase.functions.invoke('store-network', {
      body: { action: 'set-store-status', storeUserId: store.store_user_id, status: nextStatus },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || 'Não foi possível alterar a unidade.');
      return;
    }
    await refreshStores();
    await loadNetwork();
    toast.success(nextStatus === 'active' ? 'Unidade reativada.' : 'Unidade suspensa sem apagar o histórico.');
  };

  const accessStore = async (storeUserId: string) => {
    await switchStore(storeUserId);
    toast.success('Unidade alterada. Identifique o operador desta loja.');
    navigate('/operator-login', { replace: true });
  };

  if (!isActiveMulti) {
    return (
      <Card className="mx-auto max-w-3xl border-[#F2C8AB]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#003223]"><Network className="text-[#FF6400]" /> Gestão multilojas</CardTitle>
          <CardDescription>Esta área é liberada para assinaturas Multi ativas.</CardDescription>
        </CardHeader>
        <CardContent><Button onClick={() => window.location.assign('/subscription')} className="bg-[#FF6400] hover:bg-[#D95700]">Ver plano Multi</Button></CardContent>
      </Card>
    );
  }

  if (!networkId && !canManageStores) {
    return (
      <Card className="mx-auto max-w-3xl border-[#B8D7CA]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#003223]"><Network className="text-[#087A55]" /> Ativar sua rede</CardTitle>
          <CardDescription>Criaremos a loja principal sem alterar nenhum dado atual. Depois você poderá convidar as unidades adicionais.</CardDescription>
        </CardHeader>
        <CardContent><Button disabled={creating} onClick={() => void ensureNetwork()} className="bg-[#087A55] hover:bg-[#056843]">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar multilojas</Button></CardContent>
      </Card>
    );
  }

  if (networkId && !canManageStores) {
    return (
      <Card className="mx-auto max-w-3xl overflow-hidden border-[#B8D7CA]">
        <div className="h-2 bg-gradient-to-r from-[#003223] via-[#087A55] to-[#FF6400]" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#003223]"><Building2 className="text-[#087A55]" /> Unidade vinculada</CardTitle>
          <CardDescription>Seu acesso pertence à rede {stores[0]?.network_name}. Você visualiza e opera somente os dados desta unidade.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-2xl bg-[#F3FBF7] p-5">
          <p className="font-bold text-[#003223]">{stores[0]?.store_name}</p>
          <p className="text-sm text-muted-foreground">{stores[0]?.store_email || accountUser?.email}</p>
          <p className="mt-3 text-sm text-[#087A55]">A assinatura é administrada pela conta principal da rede.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="rounded-3xl bg-gradient-to-r from-[#003223] via-[#087A55] to-[#FF6400] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-white/75">REDE MULTI</p><h1 className="mt-1 text-3xl font-bold">{stores[0]?.network_name || 'Minha rede'}</h1><p className="mt-2 max-w-2xl text-white/85">Uma assinatura, unidades separadas e acesso centralizado pela conta principal.</p></div>
          <Badge className="border-white/25 bg-white/15 px-3 py-1.5 text-white">{occupiedSlots} de {capacity} lojas utilizadas</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-[#EAF7F0] p-3"><Store className="text-[#087A55]" /></div><div><p className="text-sm text-muted-foreground">Unidades ativas</p><p className="text-2xl font-bold text-[#003223]">{managedStores.filter((store) => store.status === 'active').length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-[#FFF1E8] p-3"><TrendingUp className="text-[#FF6400]" /></div><div><p className="text-sm text-muted-foreground">Vendas no mês</p><p className="text-2xl font-bold text-[#003223]">{money.format(totals.sales)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-[#EEF2FF] p-3"><Users className="text-indigo-700" /></div><div><p className="text-sm text-muted-foreground">Pedidos no mês</p><p className="text-2xl font-bold text-[#003223]">{totals.orders}</p></div></CardContent></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Unidades da rede</CardTitle><CardDescription>Entre em qualquer unidade usando o seletor do cabeçalho.</CardDescription></div><Button variant="outline" size="icon" onClick={() => void loadNetwork()}><RefreshCw className="h-4 w-4" /></Button></CardHeader>
          <CardContent className="space-y-3">
            {loading ? <Loader2 className="mx-auto my-8 animate-spin text-[#087A55]" /> : managedStores.map((store) => {
              const row = summary.find((item) => item.store_user_id === store.store_user_id);
              return <div key={store.store_user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
                <div className="rounded-xl bg-[#EAF7F0] p-2.5"><Building2 className="h-5 w-5 text-[#087A55]" /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-bold text-[#003223]">{store.store_name}</p><p className="truncate text-xs text-muted-foreground">{store.store_email}</p><p className="mt-1 text-xs font-semibold text-[#087A55]">{Number(row?.order_count || 0)} pedidos · {money.format(Number(row?.gross_sales || 0))}</p></div>
                <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>{store.status === 'active' ? 'Ativa' : 'Suspensa'}</Badge>
                {store.status === 'active' && <Button variant="outline" size="sm" onClick={() => void accessStore(store.store_user_id)}>Acessar</Button>}
                {!store.is_primary && <Button variant="ghost" size="sm" onClick={() => void setStoreStatus(store)}>{store.status === 'active' ? 'Suspender' : 'Reativar'}</Button>}
              </div>;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-[#FF6400]" /> Adicionar loja</CardTitle><CardDescription>O responsável receberá um convite e terá acesso somente à própria unidade.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="store-name">Nome da unidade</Label><Input id="store-name" value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Ex.: Loja Aldeota" /></div>
            <div className="space-y-2"><Label htmlFor="store-email">E-mail de acesso</Label><Input id="store-email" type="email" value={storeEmail} onChange={(event) => setStoreEmail(event.target.value)} placeholder="aldeota@rede.com.br" /></div>
            <Button className="w-full bg-[#FF6400] hover:bg-[#D95700]" disabled={inviting || occupiedSlots >= capacity || !storeName.trim() || !storeEmail.trim()} onClick={() => void inviteStore()}>{inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Enviar convite</Button>
            {occupiedSlots >= capacity && <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">O limite contratado foi atingido. Aumente a quantidade de lojas na assinatura para adicionar outra unidade.</p>}
            {lastInviteUrl && <div className="rounded-xl border border-[#B8D7CA] bg-[#F3FBF7] p-3"><p className="text-xs font-semibold text-[#003223]">Link alternativo do convite</p><p className="mt-1 break-all text-xs text-muted-foreground">{lastInviteUrl}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void copyInvite()}><Copy className="mr-2 h-3.5 w-3.5" />Copiar link</Button></div>}
          </CardContent>
        </Card>
      </div>

      {invitations.some((invitation) => invitation.status === 'pending') && <Card><CardHeader><CardTitle>Convites pendentes</CardTitle><CardDescription>O status muda automaticamente assim que o convidado entra pelo link e conclui o aceite.</CardDescription></CardHeader><CardContent className="space-y-2">{invitations.filter((invitation) => invitation.status === 'pending').map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{invitation.store_name}</p><p className="text-sm text-muted-foreground">{invitation.email}</p></div><div className="flex items-center gap-2"><Badge variant="secondary">Aguardando aceite</Badge><Button variant="outline" size="sm" disabled={resendingInvitationId === invitation.id} onClick={() => void resendInvitation(invitation)}>{resendingInvitationId === invitation.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-2 h-3.5 w-3.5" />}Reenviar</Button></div></div>)}</CardContent></Card>}

      <p className="text-center text-xs text-muted-foreground">Conta administradora: {accountUser?.email}</p>
    </div>
  );
}
