import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  bootstrapWaiterWeb,
  createWaiterTable,
  loadWaiterBootstrapCache,
  loadWaiterWebSession,
  logoutWaiterWeb,
  openWaiterTableSession,
  releaseWaiterTable,
  RestaurantTable,
  TableStatus,
  transferWaiterTable,
  WaiterWebStoredSession,
} from '@/services/waiterWebClient';
import { WaiterEmptyState } from '@/components/waiter-web/WaiterEmptyState';
import { WaiterMetricCard } from '@/components/waiter-web/WaiterMetricCard';
import { WaiterStatusBadge } from '@/components/waiter-web/WaiterStatusBadge';
import {
  Armchair,
  ChefHat,
  CircleDollarSign,
  LayoutGrid,
  LogOut,
  MoveRight,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

type FilterValue = 'all' | TableStatus;

const filterOptions: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'free', label: 'Livres' },
  { value: 'occupied', label: 'Ocupadas' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'ready', label: 'Prontas' },
  { value: 'check_requested', label: 'Conta solicitada' },
  { value: 'partially_paid', label: 'Parcial' },
];

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waiterSession, setWaiterSession] = useState<WaiterWebStoredSession | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [transferTable, setTransferTable] = useState<RestaurantTable | null>(null);
  const [releaseTable, setReleaseTable] = useState<RestaurantTable | null>(null);
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [guestCount, setGuestCount] = useState('2');
  const [createNumber, setCreateNumber] = useState('');
  const [createCapacity, setCreateCapacity] = useState('4');
  const [createLocation, setCreateLocation] = useState('');
  const [targetTableId, setTargetTableId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;

    loadWaiterWebSession().then((session) => {
      if (!mounted) return;

      if (!session) {
        navigate('/waiter-login', { replace: true });
        return;
      }

      const cached = loadWaiterBootstrapCache();
      if (cached?.tables?.length) {
        setTables(cached.tables);
        setLoading(false);
      }

      setWaiterSession(session);
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!waiterSession) return;

    void loadTables({ initialLoad: true, announceError: false });

    const interval = window.setInterval(() => {
      void loadTables({ initialLoad: false, announceError: false });
    }, 6000);

    return () => window.clearInterval(interval);
  }, [waiterSession]);

  const stats = useMemo(() => {
    return {
      total: tables.length,
      preparing: tables.filter((table) => table.status === 'preparing').length,
      ready: tables.filter((table) => table.status === 'ready').length,
      pendingPayment: tables.filter((table) => ['check_requested', 'partially_paid'].includes(table.status)).length,
      commandas: tables.reduce((sum, table) => sum + table.accountCount, 0),
    };
  }, [tables]);

  const filteredTables = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tables.filter((table) => {
      const matchesSearch =
        !normalizedSearch ||
        table.label.toLowerCase().includes(normalizedSearch) ||
        String(table.number).includes(normalizedSearch) ||
        String(table.location || '').toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tables, search, statusFilter]);

  const transferTargets = useMemo(() => {
    if (!transferTable?.sessionId) return [];
    return tables.filter((table) => table.id !== transferTable.id && (!table.sessionId || table.status === 'free'));
  }, [tables, transferTable]);

  const loadTables = async ({
    initialLoad,
    announceError,
  }: {
    initialLoad: boolean;
    announceError: boolean;
  }) => {
    if (!waiterSession) return;

    if (initialLoad) {
      setLoading((current) => current && !tables.length);
    } else {
      setSyncing(true);
    }

    try {
      const response = await bootstrapWaiterWeb();
      setTables(response.tables || []);
      setLoadError('');
      setWaiterSession((current) => (current ? { ...current, profile: response.profile } : current));
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel sincronizar o salao.');

      if (message.toLowerCase().includes('sess')) {
        await logoutWaiterWeb();
        navigate('/waiter-login', { replace: true });
        return;
      }

      setLoadError(message);

      if (announceError) {
        toast({
          title: 'Erro ao atualizar mesas',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logoutWaiterWeb();
    navigate('/waiter-login', { replace: true });
  };

  const handleOpenSession = async () => {
    if (!selectedTable) return;

    setSubmitting(true);
    try {
      const response = await openWaiterTableSession(
        selectedTable.id,
        selectedTable.number,
        Math.max(1, Number(guestCount || 1)),
      );
      navigate(`/waiter-session/${response.sessionId}`);
    } catch (error: any) {
      toast({
        title: 'Erro ao abrir mesa',
        description: error?.message || 'Nao foi possivel abrir a mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTable = async (openAfterCreate: boolean) => {
    const tableNumber = Number(createNumber || 0);
    const capacity = Number(createCapacity || 0);
    if (!tableNumber) return;

    setSubmitting(true);
    try {
      const response = await createWaiterTable({
        tableNumber,
        capacity,
        location: createLocation,
      });

      toast({
        title: 'Mesa criada',
        description: `Mesa ${response.table.number} pronta para operar no salao.`,
      });

      setCreateTableOpen(false);
      setCreateNumber('');
      setCreateCapacity('4');
      setCreateLocation('');

      await loadTables({ initialLoad: false, announceError: false });

      if (openAfterCreate) {
        const createdSession = await openWaiterTableSession(
          response.table.id,
          response.table.number,
          Math.max(1, Number(guestCount || 1)),
        );
        navigate(`/waiter-session/${createdSession.sessionId}`);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao criar mesa',
        description: error?.message || 'Nao foi possivel cadastrar a nova mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferTable = async () => {
    if (!transferTable?.sessionId || !targetTableId) return;

    setSubmitting(true);
    try {
      await transferWaiterTable(transferTable.sessionId, targetTableId);
      setTransferTable(null);
      setTargetTableId('');
      await loadTables({ initialLoad: false, announceError: false });
      toast({
        title: 'Mesa transferida',
        description: `Mesa ${transferTable.number} foi movida com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao transferir mesa',
        description: error?.message || 'Nao foi possivel transferir a mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseTable = async () => {
    if (!releaseTable?.sessionId) return;

    setSubmitting(true);
    try {
      await releaseWaiterTable(releaseTable.sessionId);
      setReleaseTable(null);
      await loadTables({ initialLoad: false, announceError: false });
      toast({
        title: 'Mesa liberada',
        description: `Mesa ${releaseTable.number} voltou para o mapa como livre.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao liberar mesa',
        description: error?.message || 'Nao foi possivel liberar a mesa.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07281e]">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#A4D65E]/20 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!waiterSession) return null;

  return (
    <div className="min-h-screen bg-[#EEF3EC] text-slate-900">
      <div className="bg-[radial-gradient(circle_at_top,#0D4A36_0%,#083223_48%,#07281e_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[36px] border border-white/10 bg-white/[0.05] p-5 text-white shadow-[0_35px_90px_-50px_rgba(0,0,0,0.7)] backdrop-blur-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                  BoraCume Pro Salao
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-[#A4D65E]">{waiterSession.profile.name}</div>
                  <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    Um mapa de mesas rapido, claro e pronto para alto fluxo.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/70">
                    Visualize comandas, acompanhe cozinha, abra novas operacoes e mantenha o salao sincronizado com o PDV.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => void loadTables({ initialLoad: false, announceError: true })}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button
                  className="rounded-2xl bg-[#FF6400] text-white hover:bg-[#E25A00]"
                  onClick={() => setCreateTableOpen(true)}
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

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <WaiterMetricCard
                label="Mesas no mapa"
                value={stats.total}
                hint="Todas as mesas visiveis para o restaurante."
                icon={<LayoutGrid className="h-5 w-5" />}
              />
              <WaiterMetricCard
                label="Em preparo"
                value={stats.preparing}
                hint="Mesas com pedido ja enviado para producao."
                icon={<ChefHat className="h-5 w-5" />}
              />
              <WaiterMetricCard
                label="Prontas"
                value={stats.ready}
                hint="Itens liberados para entrega no salao."
                icon={<Sparkles className="h-5 w-5" />}
              />
              <WaiterMetricCard
                label="Pagamento"
                value={stats.pendingPayment}
                hint="Mesas com conta solicitada ou recebimento parcial."
                icon={<CircleDollarSign className="h-5 w-5" />}
              />
              <WaiterMetricCard
                label="Comandas"
                value={stats.commandas}
                hint="Total de comandas ativas no salao agora."
                icon={<Users className="h-5 w-5" />}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#DCE6D8] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-[#082F23]">Tela principal de mesas</h2>
              <p className="text-sm leading-6 text-slate-500">
                Use filtros para achar rapido a mesa certa e entrar direto na operacao da comanda.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-xl lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 rounded-2xl border-[#D7E2D3] pl-10"
                  placeholder="Buscar mesa por numero ou local"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={statusFilter === filter.value ? 'default' : 'outline'}
                className={
                  statusFilter === filter.value
                    ? 'rounded-full bg-[#082F23] text-white hover:bg-[#0B4A36]'
                    : 'rounded-full border-[#D7E2D3] text-slate-600 hover:bg-[#F5F8F3]'
                }
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {loadError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {loadError}
            </div>
          ) : null}

          <div className="mt-6">
            {filteredTables.length === 0 ? (
              <WaiterEmptyState
                icon={<Armchair className="h-7 w-7" />}
                title="Nenhuma mesa encontrada"
                description="Ajuste o filtro ou cadastre uma nova mesa para iniciar o atendimento no salao."
                action={
                  <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={() => setCreateTableOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Cadastrar mesa
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTables.map((table) => {
                  const canOpenSession = !table.sessionId && table.status === 'free';
                  const canRelease = Boolean(table.sessionId) && table.dueAmount <= 0;
                  const canTransfer = Boolean(table.sessionId);

                  return (
                    <Card
                      key={table.id}
                      className="rounded-[28px] border border-[#DCE6D8] bg-[#FBFCFA] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <CardContent className="space-y-5 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mesa</div>
                            <div className="text-3xl font-semibold text-[#082F23]">{table.number}</div>
                            <div className="text-sm text-slate-500">{table.location || 'Salao principal'}</div>
                          </div>
                          <WaiterStatusBadge status={table.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total</div>
                            <div className="mt-2 text-xl font-semibold text-[#082F23]">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(table.total || 0)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pendente</div>
                            <div className="mt-2 text-xl font-semibold text-[#082F23]">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(table.dueAmount || 0)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="rounded-2xl bg-white p-3">
                            <div className="text-slate-400">Comandas</div>
                            <div className="mt-1 text-lg font-semibold text-[#082F23]">{table.accountCount}</div>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <div className="text-slate-400">Itens</div>
                            <div className="mt-1 text-lg font-semibold text-[#082F23]">{table.itemCount}</div>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <div className="text-slate-400">Prontos</div>
                            <div className="mt-1 text-lg font-semibold text-[#082F23]">{table.readyItemsCount}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="flex-1 rounded-2xl bg-[#082F23] text-white hover:bg-[#0B4A36]"
                            onClick={() => {
                              if (table.sessionId) {
                                navigate(`/waiter-session/${table.sessionId}`);
                                return;
                              }

                              setSelectedTable(table);
                              setGuestCount('2');
                            }}
                          >
                            {canOpenSession ? 'Abrir mesa' : 'Entrar na operacao'}
                          </Button>

                          {canTransfer ? (
                            <Button
                              variant="outline"
                              className="rounded-2xl border-[#D7E2D3] text-slate-600 hover:bg-[#F5F8F3]"
                              onClick={() => {
                                setTransferTable(table);
                                setTargetTableId('');
                              }}
                            >
                              <MoveRight className="mr-2 h-4 w-4" />
                              Transferir
                            </Button>
                          ) : null}

                          {canRelease ? (
                            <Button
                              variant="outline"
                              className="rounded-2xl border-[#D7E2D3] text-slate-600 hover:bg-[#F5F8F3]"
                              onClick={() => setReleaseTable(table)}
                            >
                              Liberar
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="rounded-[28px] border-0 p-0 sm:max-w-md">
          <div className="bg-[#082F23] px-6 py-6 text-white">
            <DialogTitle className="text-2xl font-semibold">Abrir Mesa {selectedTable?.number}</DialogTitle>
            <DialogDescription className="mt-2 text-white/70">
              Defina quantas comandas iniciais devem nascer na abertura desta mesa.
            </DialogDescription>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              O app cria uma comanda por pessoa inicialmente, mas depois voce pode renomear, juntar, mover itens e abrir novas comandas.
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestCount">Quantidade inicial de comandas</Label>
              <Input
                id="guestCount"
                inputMode="numeric"
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value.replace(/\D/g, '').slice(0, 2))}
                className="h-12 rounded-2xl"
              />
            </div>
            <DialogFooter className="gap-3 sm:justify-between">
              <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedTable(null)} disabled={submitting}>
                Cancelar
              </Button>
              <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={handleOpenSession} disabled={submitting}>
                {submitting ? 'Abrindo...' : 'Entrar no atendimento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createTableOpen} onOpenChange={setCreateTableOpen}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Cadastrar nova mesa</DialogTitle>
          <DialogDescription>
            Crie uma nova mesa fisica no restaurante e, se quiser, ja abra o atendimento em seguida.
          </DialogDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tableNumber">Numero da mesa</Label>
              <Input
                id="tableNumber"
                inputMode="numeric"
                value={createNumber}
                onChange={(event) => setCreateNumber(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableCapacity">Capacidade</Label>
              <Input
                id="tableCapacity"
                inputMode="numeric"
                value={createCapacity}
                onChange={(event) => setCreateCapacity(event.target.value.replace(/\D/g, '').slice(0, 3))}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableLocation">Localizacao</Label>
            <Input
              id="tableLocation"
              value={createLocation}
              onChange={(event) => setCreateLocation(event.target.value)}
              className="h-12 rounded-2xl"
              placeholder="Ex: varanda, frente, superior"
            />
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setCreateTableOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" className="rounded-2xl" onClick={() => void handleCreateTable(false)} disabled={submitting || !createNumber}>
                Criar mesa
              </Button>
              <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={() => void handleCreateTable(true)} disabled={submitting || !createNumber}>
                Criar e abrir
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transferTable)} onOpenChange={(open) => !open && setTransferTable(null)}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-lg">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Transferir mesa</DialogTitle>
          <DialogDescription>
            Leve a operacao da mesa atual para outra mesa livre do salao, mantendo comandas e pedidos.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Escolha a mesa de destino</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {transferTargets.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setTargetTableId(table.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    targetTableId === table.id ? 'border-[#082F23] bg-[#EDF4E8]' : 'border-[#D7E2D3] bg-white'
                  }`}
                >
                  <div className="font-semibold text-[#082F23]">Mesa {table.number}</div>
                  <div className="mt-1 text-sm text-slate-500">{table.location || 'Salao principal'}</div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setTransferTable(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleTransferTable} disabled={submitting || !targetTableId}>
              Confirmar transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(releaseTable)} onOpenChange={(open) => !open && setReleaseTable(null)}>
        <DialogContent className="rounded-[28px] border-0 sm:max-w-md">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Liberar mesa</DialogTitle>
          <DialogDescription>
            Esta acao encerra a operacao e devolve a mesa ao mapa como livre.
          </DialogDescription>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Use esta opcao apenas quando todas as comandas da mesa estiverem fechadas.
          </div>
          <DialogFooter className="gap-3 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setReleaseTable(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#082F23] hover:bg-[#0B4A36]" onClick={handleReleaseTable} disabled={submitting}>
              Liberar mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiterDashboard;
