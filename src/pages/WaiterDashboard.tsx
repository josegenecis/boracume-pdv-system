import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  bootstrapWaiterWeb,
  formatMoney,
  loadWaiterWebSession,
  logoutWaiterWeb,
  openWaiterTableSession,
  RestaurantTable,
  WaiterWebStoredSession,
} from '@/services/waiterWebClient';
import { useToast } from '@/hooks/use-toast';
import {
  Armchair,
  ChevronRight,
  Clock3,
  LogOut,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

const APP_ARTWORK = '/waiter/app-garcom.png';
const BRAND_WORDMARK = '/waiter/logo-boracume.png';

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waiterSession, setWaiterSession] = useState<WaiterWebStoredSession | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [guestCount, setGuestCount] = useState('2');

  useEffect(() => {
    let mounted = true;
    loadWaiterWebSession().then((session) => {
      if (!mounted) return;
      if (!session) {
        navigate('/waiter-login', { replace: true });
        return;
      }
      setWaiterSession(session);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!waiterSession) return;
    loadTables();
    const interval = window.setInterval(() => {
      loadTables(false);
    }, 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [waiterSession]);

  const stats = useMemo(() => {
    const active = tables.filter((table) => table.status !== 'free').length;
    const free = tables.filter((table) => table.status === 'free').length;
    const serving = tables.filter((table) => table.status === 'serving').length;
    return { active, free, serving };
  }, [tables]);

  const loadTables = async (showSpinner = true) => {
    if (!waiterSession) return;
    if (showSpinner) setLoading(true);
    try {
      const response = await bootstrapWaiterWeb();
      setTables(response.tables || []);
      setWaiterSession((current) => current ? { ...current, profile: response.profile } : current);
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('sessão')) {
        await logoutWaiterWeb();
        navigate('/waiter-login', { replace: true });
        return;
      }
      toast({
        title: 'Erro ao carregar o salão',
        description: error?.message || 'Não foi possível atualizar as mesas.',
        variant: 'destructive',
      });
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutWaiterWeb();
    navigate('/waiter-login', { replace: true });
  };

  const handleTablePress = (table: RestaurantTable) => {
    if (table.sessionId) {
      navigate(`/waiter-session/${table.sessionId}`);
      return;
    }
    setSelectedTable(table);
    setGuestCount('2');
  };

  const handleOpenTable = async () => {
    if (!selectedTable) return;
    setOpening(true);
    try {
      const response = await openWaiterTableSession(selectedTable.id, selectedTable.number, Math.max(1, Number(guestCount || 1)));
      setSelectedTable(null);
      await loadTables(false);
      navigate(`/waiter-session/${response.sessionId}`);
    } catch (error: any) {
      toast({
        title: 'Erro ao abrir mesa',
        description: error?.message || 'Não foi possível iniciar a sessão da mesa.',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_40%,#f8fafc_100%)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!waiterSession) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#003223_0px,#003223_260px,#f7efe6_260px,#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] bg-[#003223] p-6 text-white shadow-[0_35px_80px_-45px_rgba(0,50,35,0.65)]">
          <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-[#8CC850]/15 blur-3xl" />
          <div className="absolute -left-6 bottom-0 h-32 w-32 rounded-full bg-[#FF6400]/15 blur-2xl" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative z-10 flex items-center gap-4">
              <img src={APP_ARTWORK} alt="App Garçom BoraCumê" className="h-20 w-20 rounded-[24px] object-contain shadow-2xl" />
              <div className="min-w-0">
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                  BoraCumê Garçom
                </div>
                <img src={BRAND_WORDMARK} alt="BoraCumê" className="mt-3 h-10 w-auto object-contain" />
                <h1 className="mt-3 text-3xl font-black">Salão em tempo real</h1>
                <p className="mt-1 text-sm text-white/70">
                  {waiterSession.profile.name} • {stats.active} mesas em operação agora
                </p>
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => loadTables()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button
                className="rounded-2xl bg-[#FF6400] hover:bg-[#e55a00]"
                onClick={() => {
                  const freeTable = tables.find((table) => table.status === 'free');
                  if (freeTable) {
                    handleTablePress(freeTable);
                    return;
                  }
                  toast({
                    title: 'Nenhuma mesa livre',
                    description: 'Finalize ou libere uma mesa para abrir nova sessão.',
                    variant: 'destructive',
                  });
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova mesa
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>

          <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Mesas livres</div>
                <div className="mt-2 text-3xl font-black">{stats.free}</div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Em operação</div>
                <div className="mt-2 text-3xl font-black">{stats.active}</div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-0 bg-white/10 text-white">
              <CardContent className="p-5">
                <div className="text-sm text-white/70">Servindo</div>
                <div className="mt-2 text-3xl font-black">{stats.serving}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Mapa de mesas</h2>
              <p className="text-sm text-slate-500">A mesma lógica do app Android, agora também no navegador.</p>
            </div>
            <Badge className="rounded-full bg-[#FFF1E8] px-3 py-1 text-[#C14E00] hover:bg-[#FFF1E8]">
              {tables.length} mesas carregadas
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => {
              const accent =
                table.status === 'free'
                  ? 'border-[#8CC850]/30 bg-[#F8FCF3]'
                  : table.status === 'serving'
                    ? 'border-[#FF6400]/30 bg-[#FFF7F2]'
                    : 'border-[#D39BFF]/30 bg-[#FBF5FF]';

              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer rounded-[28px] border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${accent}`}
                  onClick={() => handleTablePress(table)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-black text-slate-900">Mesa {table.number}</CardTitle>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 text-slate-700">
                        {table.status === 'free' ? 'Livre' : table.status === 'serving' ? 'Servindo' : 'Aberta'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                      <div className="rounded-2xl bg-white/80 p-3">
                        <div className="flex items-center gap-2 font-semibold text-slate-500">
                          <Users className="h-4 w-4" />
                          Capacidade
                        </div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{table.capacity || '-'}</div>
                      </div>
                      <div className="rounded-2xl bg-white/80 p-3">
                        <div className="flex items-center gap-2 font-semibold text-slate-500">
                          <Clock3 className="h-4 w-4" />
                          Aberta
                        </div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{table.openMinutes ? `${table.openMinutes} min` : '-'}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/85 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total em consumo</div>
                      <div className="mt-2 text-2xl font-black text-slate-900">{formatMoney(table.total)}</div>
                      <div className="mt-2 text-sm text-slate-500">{table.location || 'Salão principal'}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                      <span>{table.sessionId ? 'Continuar sessão' : 'Abrir sessão'}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="bg-[#003223] px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Armchair className="h-5 w-5 text-[#8CC850]" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black">Abrir Mesa {selectedTable?.number}</DialogTitle>
                <DialogDescription className="text-white/70">
                  Defina quantas pessoas estão na mesa para criar as comandas iniciais.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              O sistema cria uma conta por pessoa e você pode adicionar ou remover contas depois.
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestCount">Número de pessoas</Label>
              <Input
                id="guestCount"
                inputMode="numeric"
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-12 rounded-2xl"
              />
            </div>
            <DialogFooter className="gap-3 sm:justify-between">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setSelectedTable(null)}
                disabled={opening}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-2xl bg-[#FF6400] hover:bg-[#e55a00]"
                onClick={handleOpenTable}
                disabled={opening || Math.max(1, Number(guestCount || 1)) <= 0}
              >
                {opening ? 'Abrindo...' : (
                  <>
                    Criar sessão
                    <Sparkles className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiterDashboard;
