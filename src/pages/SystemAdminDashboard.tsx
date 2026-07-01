import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type MetricMap = Record<string, number>;

interface AdminClientRow {
  id: string;
  restaurantName: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string | null;
  lastSignInAt?: string | null;
  lastAccessAt?: string | null;
  subscriptionStatus?: string;
  planName?: string;
  planPrice?: number;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  ordersMonth?: number;
  lastOrderAt?: string | null;
  productsCount?: number;
  customersCount?: number;
  whatsappEnabled?: boolean;
  nfceAuthorizedMonth?: number;
  nfceRejectedMonth?: number;
  reasons?: string[];
}

interface AdminDashboardData {
  generatedAt: string;
  metrics: MetricMap;
  lists: {
    newToday: AdminClientRow[];
    recentSignups: AdminClientRow[];
    delinquent: AdminClientRow[];
    trialExpiring: AdminClientRow[];
    attention: AdminClientRow[];
    activeByAccess: AdminClientRow[];
    inactiveByAccess: AdminClientRow[];
    neverAccessed: AdminClientRow[];
    paidThisMonth: AdminClientRow[];
  };
}

const SESSION_KEY = 'popsystem-internal-admin-token';

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatNumber = (value?: number) =>
  new Intl.NumberFormat('pt-BR').format(Number(value || 0));

const formatPercent = (value?: number, total?: number) => {
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / Number(total || 1)) * 100)}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    year: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeStatusLabel = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (['active', 'paid', 'current'].includes(value)) return 'Ativo';
  if (value.includes('trial') || value === 'teste') return 'Teste';
  if (['past_due', 'unpaid', 'overdue', 'inadimplente'].includes(value)) return 'Inadimplente';
  if (['blocked', 'suspended'].includes(value)) return 'Bloqueado';
  if (!value || value === 'sem_assinatura') return 'Sem assinatura';
  return value.replaceAll('_', ' ');
};

const lastAccessLabel = (value?: string | null) => {
  if (!value) return 'Nunca acessou';
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return 'Nunca acessou';
  const diffDays = Math.floor((Date.now() - ms) / 86400000);
  if (diffDays <= 0) return 'Acessou hoje';
  if (diffDays === 1) return 'Acessou ontem';
  return `Há ${diffDays} dias`;
};

const statusClassName = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (['active', 'paid', 'current'].includes(value)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (value.includes('trial') || value === 'teste') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['past_due', 'unpaid', 'overdue', 'inadimplente', 'blocked', 'suspended'].includes(value)) {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'emerald',
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone?: 'emerald' | 'orange' | 'blue' | 'red' | 'slate';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-lg border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ClientList({
  title,
  description,
  clients,
  emptyText,
}: {
  title: string;
  description: string;
  clients: AdminClientRow[];
  emptyText: string;
}) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {clients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">{emptyText}</div>
        ) : (
          clients.map((client) => (
            <div key={`${title}-${client.id}`} className="rounded-lg border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{client.restaurantName}</p>
                  <p className="truncate text-sm text-slate-500">{client.email || client.phone || 'Sem contato cadastrado'}</p>
                </div>
                <Badge className={statusClassName(client.subscriptionStatus)} variant="outline">
                  {normalizeStatusLabel(client.subscriptionStatus)}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
                <span>{lastAccessLabel(client.lastAccessAt)}</span>
                <span>{formatNumber(client.ordersMonth)} pedidos</span>
                <span>{formatNumber(client.productsCount)} produtos</span>
                <span>Último pedido: {formatDateTime(client.lastOrderAt)}</span>
              </div>
              {client.reasons && client.reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {client.reasons.map((reason) => (
                    <span key={`${client.id}-${reason}`} className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemAdminDashboard() {
  const [email, setEmail] = useState('admin@popsystem.com.br');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const metrics = data?.metrics || {};
  const lists = data?.lists;

  const accessHealth = useMemo(() => formatPercent(metrics.accessed7Days, metrics.totalClients), [metrics.accessed7Days, metrics.totalClients]);

  const loadDashboard = useCallback(async (sessionToken = token) => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-dashboard', {
        body: { token: sessionToken },
      });
      if (error) throw error;
      if (!response?.ok) throw new Error(response?.error || 'Não foi possível carregar o painel.');
      setData(response as AdminDashboardData);
    } catch (error: any) {
      sessionStorage.removeItem(SESSION_KEY);
      setToken('');
      setData(null);
      toast.error(error?.message || 'Sessão interna expirada. Entre novamente.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadDashboard(token);
  }, [loadDashboard, token]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-dashboard', {
        body: { action: 'login', email, password },
      });
      if (error) throw error;
      if (!response?.ok || !response?.token) throw new Error(response?.error || 'Login interno inválido.');
      sessionStorage.setItem(SESSION_KEY, response.token);
      setToken(response.token);
      setPassword('');
      toast.success('Painel interno liberado');
      await loadDashboard(response.token);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível entrar no painel interno.');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken('');
    setData(null);
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Acesso interno PopSystem
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
                Painel de comando para acompanhar clientes, acessos e riscos da operação.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-300">
                Veja cadastros do dia, último acesso, restaurantes em teste, inadimplentes,
                clientes pagos no mês e quem precisa de contato da equipe.
              </p>
              <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <span className="rounded-lg border border-white/10 bg-white/5 p-4">Comercial</span>
                <span className="rounded-lg border border-white/10 bg-white/5 p-4">Financeiro</span>
                <span className="rounded-lg border border-white/10 bg-white/5 p-4">Sucesso do cliente</span>
              </div>
            </section>

            <Card className="rounded-lg border-white/10 bg-white text-slate-950 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  Entrar no painel
                </CardTitle>
                <p className="text-sm text-slate-500">Use o login interno da equipe PopSystem.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">E-mail</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Senha</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button type="submit" className="h-12 w-full bg-orange-600 text-base font-bold hover:bg-orange-700" disabled={loginLoading}>
                    {loginLoading ? 'Entrando...' : 'Acessar painel interno'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Painel interno</p>
            <h1 className="text-2xl font-bold text-slate-950">Monitoramento PopSystem</h1>
            <p className="text-sm text-slate-500">Atualizado em {formatDateTime(data?.generatedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => loadDashboard()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Clientes cadastrados" value={formatNumber(metrics.totalClients)} detail={`${formatNumber(metrics.newToday)} hoje, ${formatNumber(metrics.newMonth)} no mês`} icon={Users} tone="blue" />
          <MetricCard title="Acessaram hoje" value={formatNumber(metrics.accessedToday)} detail={`${accessHealth} acessaram nos últimos 7 dias`} icon={Activity} tone="emerald" />
          <MetricCard title="Ativos por assinatura" value={formatNumber(metrics.activeClients)} detail={`${formatNumber(metrics.paidThisMonth)} pagaram ou renovaram no mês`} icon={UserCheck} tone="emerald" />
          <MetricCard title="Inadimplentes" value={formatNumber(metrics.delinquentClients)} detail="Precisam de contato ou bloqueio acompanhado" icon={AlertTriangle} tone="red" />
          <MetricCard title="Em teste" value={formatNumber(metrics.trialClients)} detail={`${formatNumber(metrics.trialExpiring)} vencem nos próximos 7 dias`} icon={CalendarClock} tone="orange" />
          <MetricCard title="Sem acesso há 7 dias" value={formatNumber(metrics.noAccess7Days)} detail={`${formatNumber(metrics.noAccess30Days)} estão sem acesso há 30 dias`} icon={AlertTriangle} tone="red" />
          <MetricCard title="Nunca acessaram" value={formatNumber(metrics.neverAccessed)} detail="Cadastros que precisam de onboarding" icon={ShieldCheck} tone="orange" />
          <MetricCard title="MRR previsto" value={formatCurrency(metrics.mrr)} detail="Receita recorrente estimada da PopSystem" icon={DollarSign} tone="emerald" />
          <MetricCard title="Pedidos no mês" value={formatNumber(metrics.ordersMonth)} detail={`${formatNumber(metrics.noOrders7Days)} restaurantes sem pedido há 7 dias`} icon={TrendingUp} tone="slate" />
          <MetricCard title="WhatsApp conectado" value={formatNumber(metrics.whatsappConfigured)} detail={`${formatNumber(metrics.nfceRejectedMonth)} NFC-e rejeitadas no mês`} icon={MessageCircle} tone="blue" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ClientList
            title="Clientes que precisam de ação"
            description="Prioridade para suporte, financeiro e sucesso do cliente."
            clients={lists?.attention || []}
            emptyText="Nenhum alerta crítico agora."
          />

          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Saúde da base
              </CardTitle>
              <p className="text-sm text-slate-500">Leitura rápida para saber onde atuar hoje.</p>
            </CardHeader>
            <CardContent className="space-y-5 p-5 pt-0">
              {[
                { label: 'Ativos', value: metrics.activeClients, total: metrics.totalClients, color: 'bg-emerald-500' },
                { label: 'Acessaram em 7 dias', value: metrics.accessed7Days, total: metrics.totalClients, color: 'bg-emerald-500' },
                { label: 'WhatsApp configurado', value: metrics.whatsappConfigured, total: metrics.totalClients, color: 'bg-blue-500' },
                { label: 'Inadimplentes', value: metrics.delinquentClients, total: metrics.totalClients, color: 'bg-red-500' },
                { label: 'Em teste', value: metrics.trialClients, total: metrics.totalClients, color: 'bg-orange-500' },
              ].map((item) => {
                const percent = item.total ? Math.round((Number(item.value || 0) / Number(item.total || 1)) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-2 flex justify-between text-sm font-semibold text-slate-700">
                      <span>{item.label}</span>
                      <span>{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}

              <div className="rounded-lg bg-slate-950 p-5 text-white">
                <p className="text-sm text-slate-300">Acessaram nos últimos 30 dias</p>
                <p className="mt-1 text-3xl font-bold">{formatNumber(metrics.accessed30Days)}</p>
                <p className="mt-2 text-sm text-slate-300">Esse número mostra a base realmente usando o sistema.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ClientList
            title="Novos cadastros"
            description="Restaurantes que entraram recentemente na plataforma."
            clients={lists?.recentSignups || []}
            emptyText="Nenhum cadastro recente."
          />
          <ClientList
            title="Clientes inadimplentes"
            description="Base para cobrança e acompanhamento financeiro."
            clients={lists?.delinquent || []}
            emptyText="Nenhum cliente inadimplente encontrado."
          />
          <ClientList
            title="Testes vencendo"
            description="Oportunidade de conversão antes do fim do teste."
            clients={lists?.trialExpiring || []}
            emptyText="Nenhum teste vencendo nos próximos 7 dias."
          />
          <ClientList
            title="Pagaram no mês"
            description="Clientes que estão ativos ou renovados no período atual."
            clients={lists?.paidThisMonth || []}
            emptyText="Nenhum pagamento/renovação identificado no mês."
          />
          <ClientList
            title="Sem acesso recente"
            description="Clientes que podem estar travados, desmotivados ou precisando de suporte."
            clients={lists?.inactiveByAccess || []}
            emptyText="Todos acessaram recentemente."
          />
          <ClientList
            title="Nunca acessaram"
            description="Cadastros que precisam de ativação ou primeiro contato."
            clients={lists?.neverAccessed || []}
            emptyText="Nenhum cliente sem primeiro acesso."
          />
        </section>

        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
              <Building2 className="h-5 w-5 text-orange-600" />
              Últimos acessos ao sistema
            </CardTitle>
            <p className="text-sm text-slate-500">Clientes ordenados por atividade real no sistema.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-5 pt-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3">Restaurante</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Último acesso</th>
                  <th className="py-3">Pedidos</th>
                  <th className="py-3">Clientes</th>
                  <th className="py-3">WhatsApp</th>
                  <th className="py-3">Último pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(lists?.activeByAccess || []).map((client) => (
                  <tr key={`rank-${client.id}`} className="text-slate-700">
                    <td className="py-4">
                      <div className="font-semibold text-slate-950">{client.restaurantName}</div>
                      <div className="text-xs text-slate-500">{client.email || client.phone || 'Sem contato'}</div>
                    </td>
                    <td className="py-4">
                      <Badge className={statusClassName(client.subscriptionStatus)} variant="outline">
                        {normalizeStatusLabel(client.subscriptionStatus)}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <div className="font-semibold text-slate-950">{lastAccessLabel(client.lastAccessAt)}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(client.lastAccessAt)}</div>
                    </td>
                    <td className="py-4">{formatNumber(client.ordersMonth)}</td>
                    <td className="py-4">{formatNumber(client.customersCount)}</td>
                    <td className="py-4">
                      {client.whatsappEnabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Sim</span>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </td>
                    <td className="py-4">{formatDateTime(client.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
