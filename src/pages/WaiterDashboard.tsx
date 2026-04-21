import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
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
  AlertTriangle,
  Armchair,
  ChevronRight,
  Clock3,
  LogOut,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

const statusLabel: Record<RestaurantTable['status'], string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  serving: 'Servindo',
  payment_pending: 'Pagamento',
};

const statusTone: Record<RestaurantTable['status'], string> = {
  free: 'border-[#D7E9CF] bg-[#F5FBF1] text-[#2F6A2F]',
  occupied: 'border-[#F2D8C3] bg-[#FFF6EF] text-[#9B4B12]',
  serving: 'border-[#CFE4DA] bg-[#F0F8F4] text-[#0B4A36]',
  payment_pending: 'border-[#E9DAF7] bg-[#FBF6FF] text-[#6C3EA1]',
};

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waiterSession, setWaiterSession] = useState<WaiterWebStoredSession | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [guestCount, setGuestCount] = useState('2');
  const [loadError, setLoadError] = useState('');

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

    loadTables({ showSpinner: true, announceError: false });
    const interval = window.setInterval(() => {
      loadTables({ showSpinner: false, announceError: false });
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [waiterSession]);

  const stats = useMemo(() => {
    const free = tables.filter((table) => table.status === 'free').length;
    const serving = tables.filter((table) => table.status === 'serving').length;
    const occupied = tables.filter((table) => table.status !== 'free').length;

    return {
      total: tables.length,
      free,
      serving,
      occupied,
    };
  }, [tables]);

  const loadTables = async ({
    showSpinner = true,
    announceError = false,
  }: {
    showSpinner?: boolean;
    announceError?: boolean;
  } = {}) => {
    if (!waiterSession) return;
    if (showSpinner) setLoading(true);

    try {
      const response = await bootstrapWaiterWeb();
      setTables(response.tables || []);
      setLoadError('');
      setWaiterSession((current) => (current ? { ...current, profile: response.profile } : current));
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel atualizar as mesas.');

      if (message.toLowerCase().includes('sess')) {
        await logoutWaiterWeb();
        navigate('/waiter-login', { replace: true });
        return;
      }

      setLoadError(message);

      if (announceError) {
        toast({
          title: 'Erro ao atualizar o salao',
          description: message,
          variant: 'destructive',
        });
      }
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

    if (table.status !== 'free') {
      toast({
        title: 'Mesa ocupada',
        description: 'Esta mesa ja esta em uso no sistema do restaurante.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedTable(table);
    setGuestCount('2');
  };

  const handleOpenTable = async () => {
    if (!selectedTable) return;

    setOpening(true);
    try {
      const response = await openWaiterTableSession(
        selectedTable.id,
        selectedTable.number,
        Math.max(1, Number(guestCount || 1)),
      );

      setSelectedTable(null);
      await loadTables({ showSpinner: false, announceError: false });
      navigate(`/waiter-session/${response.sessionId}`);
    } catch (error: any) {
      toast({
        title: 'Erro ao abrir mesa',
        description: error?.message || 'Nao foi possivel iniciar a sessao da mesa.',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F6F0]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6400]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!waiterSession) return null;

  return (
    <div className="min-h-screen bg-[#F2F6F0] text-slate-900">
      <div className="bg-[linear-gradient(180deg,#082F23_0%,#0A3A2B_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 text-white shadow-[0_24px_70px_-45px_rgba(0,0,0,0.65)] backdrop-blur-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
                  BoraCumê Garçom Web
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">Salão do restaurante</h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/70">
                    Acompanhe as mesas cadastradas no sistema, atualize o status do salao e abra novas sessoes quando houver
                    mesas livres.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                    <Store className="h-4 w-4 text-[#8CC850]" />
                    <span>{waiterSession.profile.name}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                    <Users className="h-4 w-4 text-[#8CC850]" />
                    <span>{stats.total} mesas encontradas</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => loadTables({ showSpinner: true, announceError: true })}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>

                <Button
                  className="rounded-2xl bg-[#FF6400] hover:bg-[#E75B00]"
                  onClick={() => {
                    const freeTable = tables.find((table) => table.status === 'free');

                    if (freeTable) {
                      handleTablePress(freeTable);
                      return;
                    }

                    toast({
                      title: 'Nenhuma mesa livre',
                      description: 'Nao ha mesas livres para iniciar uma nova sessao agora.',
                      variant: 'destructive',
                    });
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nova mesa
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Card className="rounded-[24px] border-0 bg-white/8 text-white">
                <CardContent className="p-5">
                  <div className="text-sm text-white/65">Mesas cadastradas</div>
                  <div className="mt-2 text-3xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border-0 bg-white/8 text-white">
                <CardContent className="p-5">
                  <div className="text-sm text-white/65">Mesas livres</div>
                  <div className="mt-2 text-3xl font-bold">{stats.free}</div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border-0 bg-white/8 text-white">
                <CardContent className="p-5">
                  <div className="text-sm text-white/65">Mesas ocupadas</div>
                  <div className="mt-2 text-3xl font-bold">{stats.occupied}</div>
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border-0 bg-white/8 text-white">
                <CardContent className="p-5">
                  <div className="text-sm text-white/65">Servindo</div>
                  <div className="mt-2 text-3xl font-bold">{stats.serving}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {loadError ? (
          <div className="mb-5 flex items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
            <div>
              <div className="font-semibold">Sincronizacao parcial do salao</div>
              <div className="text-sm leading-6">{loadError}</div>
            </div>
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0B2E22]">Mapa de mesas</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Visualizacao conectada as mesas reais do restaurante, com status, ocupacao e valor em consumo.
            </p>
          </div>

          <Badge className="w-fit rounded-full border border-[#D7E9CF] bg-[#F7FBF4] px-3 py-1 text-[#2F6A2F] hover:bg-[#F7FBF4]">
            {stats.total} mesas carregadas
          </Badge>
        </div>

        {tables.length === 0 ? (
          <Card className="rounded-[28px] border border-[#DDE7D9] bg-white shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF5EA] text-[#2F6A2F]">
                <Armchair className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-[#0B2E22]">Nenhuma mesa encontrada</h3>
                <p className="max-w-lg text-sm leading-6 text-slate-600">
                  Este acesso ainda nao encontrou mesas disponiveis no restaurante. Atualize a pagina depois de revisar o
                  cadastro das mesas no sistema principal.
                </p>
              </div>
              <Button
                className="rounded-2xl bg-[#FF6400] hover:bg-[#E75B00]"
                onClick={() => loadTables({ showSpinner: true, announceError: true })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((table) => {
              const canContinue = Boolean(table.sessionId);
              const canOpen = table.status === 'free' && !table.sessionId;
              const actionLabel = canContinue ? 'Continuar sessao' : canOpen ? 'Abrir sessao' : 'Mesa ocupada no sistema';

              return (
                <Card
                  key={table.id}
                  className="rounded-[28px] border border-[#DDE7D9] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <CardContent className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mesa</div>
                        <div className="mt-1 text-3xl font-semibold text-[#0B2E22]">{table.number}</div>
                      </div>

                      <Badge className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[table.status]}`}>
                        {statusLabel[table.status]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#F6F8F4] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <Users className="h-4 w-4" />
                          Lugares
                        </div>
                        <div className="mt-3 text-xl font-semibold text-[#0B2E22]">{table.capacity || '-'}</div>
                      </div>

                      <div className="rounded-2xl bg-[#F6F8F4] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <Clock3 className="h-4 w-4" />
                          Aberta ha
                        </div>
                        <div className="mt-3 text-xl font-semibold text-[#0B2E22]">
                          {table.openMinutes ? `${table.openMinutes} min` : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E5ECE2] bg-[#FBFCFA] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Consumo atual</div>
                      <div className="mt-2 text-2xl font-semibold text-[#0B2E22]">{formatMoney(table.total)}</div>
                      <div className="mt-2 text-sm text-slate-500">{table.location || 'Salao principal'}</div>
                    </div>

                    <Button
                      variant={canOpen || canContinue ? 'default' : 'outline'}
                      className={
                        canOpen || canContinue
                          ? 'h-12 w-full rounded-2xl bg-[#0B4A36] text-white hover:bg-[#0D5740]'
                          : 'h-12 w-full rounded-2xl border-[#DDE7D9] text-slate-500 hover:bg-[#F8FAF7]'
                      }
                      onClick={() => handleTablePress(table)}
                    >
                      <span>{actionLabel}</span>
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="bg-[#082F23] px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Armchair className="h-5 w-5 text-[#8CC850]" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-semibold">Abrir Mesa {selectedTable?.number}</DialogTitle>
                <DialogDescription className="text-white/70">
                  Defina quantas pessoas estao na mesa para criar as comandas iniciais.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              O sistema cria uma conta por pessoa, e voce pode ajustar as contas depois dentro da sessao da mesa.
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestCount">Numero de pessoas</Label>
              <Input
                id="guestCount"
                inputMode="numeric"
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-12 rounded-2xl"
              />
            </div>

            <DialogFooter className="gap-3 sm:justify-between">
              <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedTable(null)} disabled={opening}>
                Cancelar
              </Button>

              <Button
                className="rounded-2xl bg-[#FF6400] hover:bg-[#E75B00]"
                onClick={handleOpenTable}
                disabled={opening || Math.max(1, Number(guestCount || 1)) <= 0}
              >
                {opening ? (
                  'Abrindo...'
                ) : (
                  <>
                    Criar sessao
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
