import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
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
import { WaiterBottomNav } from '@/components/waiter-web/WaiterBottomNav';
import { WaiterEmptyState } from '@/components/waiter-web/WaiterEmptyState';
import { StoneIntegrationPanel } from '@/components/waiter-web/StoneIntegrationPanel';
import { formatElapsedMinutes } from '@/utils/elapsedTime';
import {
  Armchair,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  LayoutGrid,
  LogOut,
  PlusCircle,
  RefreshCw,
  Settings,
} from 'lucide-react';

const tableTileTone: Record<TableStatus, string> = {
  free: 'bg-[#A4D65E] text-[#083223]',
  occupied: 'bg-[#FF7A00] text-white',
  preparing: 'bg-[#F2BE49] text-[#083223]',
  ready: 'bg-[#B7E66A] text-[#083223]',
  check_requested: 'bg-[#E53935] text-white',
  partially_paid: 'bg-[#FFB347] text-[#083223]',
};

const tableOccupancyLabel = (status: TableStatus) => (status === 'free' ? 'Livre' : 'Ocupada');

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waiterSession, setWaiterSession] = useState<WaiterWebStoredSession | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [transferTable, setTransferTable] = useState<RestaurantTable | null>(null);
  const [releaseTable, setReleaseTable] = useState<RestaurantTable | null>(null);
  const [stoneSettingsOpen, setStoneSettingsOpen] = useState(false);
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [guestCount, setGuestCount] = useState('2');
  const [customerName, setCustomerName] = useState('');
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

  const filteredTables = useMemo(() => {
    return [...tables].sort((left, right) => left.number - right.number);
  }, [tables]);

  const transferTargets = useMemo(() => {
    if (!transferTable?.sessionId) return [];
    return tables.filter((table) => table.id !== transferTable.id && (!table.sessionId || table.status === 'free'));
  }, [tables, transferTable]);

  const firstReceivableTable = useMemo(() => {
    return filteredTables.find((table) => table.sessionId && table.dueAmount > 0) || null;
  }, [filteredTables]);

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
        customerName,
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
          customerName,
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
    <div className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,#0B5138_0%,#083927_40%,#072C1F_100%)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-white">
      <div className="mx-auto w-full min-w-0 max-w-[430px] px-4 py-3 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-1.5 flex flex-col items-center text-center">
          <Logo size="md" theme="dark" className="max-w-full justify-center" />
          <div className="mt-2 inline-flex max-w-full rounded-full bg-white/10 px-3 py-1 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-white/80">
            App web Garçom
          </div>
          <h1 className="mt-2.5 text-[1.55rem] font-semibold leading-tight text-white sm:text-[1.95rem]">Mesas</h1>
          <p className="mt-1 text-[11px] leading-4 text-white/68 sm:text-xs sm:leading-5">{waiterSession.profile.name}</p>
        </div>

        {loadError ? (
          <div className="mt-4 rounded-[20px] border border-red-300/60 bg-red-500/90 px-4 py-3 text-sm font-medium text-white">
            {loadError}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {[
            {
              label: 'Mesas',
              icon: <LayoutGrid className="h-5 w-5" />,
              onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            },
            {
              label: 'Comandas',
              icon: <ClipboardList className="h-5 w-5" />,
              onClick: () => {
                const table = filteredTables.find((current) => current.sessionId);
                if (table?.sessionId) navigate(`/waiter-session/${table.sessionId}`);
              },
            },
            {
              label: 'Pedidos',
              icon: <ChefHat className="h-5 w-5" />,
              onClick: () => {
                const table = filteredTables.find((current) => current.sentItemsCount > 0 && current.sessionId);
                if (table?.sessionId) navigate(`/waiter-session/${table.sessionId}`);
              },
            },
            {
              label: 'Receber',
              icon: <CircleDollarSign className="h-5 w-5" />,
              onClick: () => {
                if (firstReceivableTable?.sessionId) {
                  navigate(`/waiter-session/${firstReceivableTable.sessionId}?tab=payments`);
                  return;
                }
                toast({ title: 'Nenhuma conta em aberto', description: 'Nao encontrei mesa com saldo para receber agora.' });
              },
            },
            {
              label: 'Config.',
              icon: <Settings className="h-5 w-5" />,
              onClick: () => setStoneSettingsOpen(true),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-[22px] border border-white/15 bg-white/12 px-3 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-28px_rgba(0,0,0,0.9)] transition active:scale-[0.98]"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          {filteredTables.length === 0 ? (
            <WaiterEmptyState
              icon={<Armchair className="h-7 w-7" />}
              title="Nenhuma mesa encontrada"
              description="Cadastre uma nova mesa para iniciar o atendimento no salao."
              action={
                <Button className="h-10 rounded-2xl bg-[#FF6400] text-sm hover:bg-[#E25A00]" onClick={() => setCreateTableOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Cadastrar mesa
                </Button>
              }
            />
          ) : (
            <div className="grid w-full min-w-0 grid-cols-3 gap-2.5 min-[390px]:grid-cols-4 sm:grid-cols-5 sm:gap-3 lg:grid-cols-6">
              {filteredTables.map((table) => {
                return (
                  <div
                    key={table.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (table.sessionId) {
                        navigate(`/waiter-session/${table.sessionId}`);
                        return;
                      }

                      setCustomerName('');
                      setSelectedTable(table);
                      setGuestCount('2');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (table.sessionId) {
                          navigate(`/waiter-session/${table.sessionId}`);
                          return;
                        }

                        setCustomerName('');
                        setSelectedTable(table);
                        setGuestCount('2');
                      }
                    }}
                    className={`relative flex aspect-square min-w-0 cursor-pointer flex-col rounded-[18px] p-2 text-left shadow-[0_16px_34px_-24px_rgba(0,0,0,0.8)] transition active:scale-[0.98] sm:rounded-[24px] sm:p-3 ${tableTileTone[table.status]}`}
                  >
                    <div className="flex min-w-0 items-start justify-start">
                      <span className="max-w-full truncate rounded-full bg-black/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.04em] text-current sm:px-2 sm:py-1 sm:text-[9px]">
                        {tableOccupancyLabel(table.status)}
                      </span>
                    </div>

                    <div className="flex flex-1 items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-semibold leading-none sm:text-5xl">{table.number}</div>
                        {table.status !== 'free' ? (
                          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] opacity-80 sm:text-xs">
                            {formatElapsedMinutes(table.openMinutes)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <WaiterBottomNav
        items={[
          {
            key: 'tables',
            label: 'Mesas',
            icon: <LayoutGrid className="h-4 w-4" />,
            active: true,
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
          },
          {
            key: 'new',
            label: 'Nova mesa',
            icon: <PlusCircle className="h-4 w-4" />,
            onClick: () => setCreateTableOpen(true),
          },
          {
            key: 'refresh',
            label: 'Atualizar',
            icon: <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />,
            onClick: () => void loadTables({ initialLoad: false, announceError: true }),
          },
          {
            key: 'logout',
            label: 'Sair',
            icon: <LogOut className="h-4 w-4" />,
            onClick: () => void handleLogout(),
          },
        ]}
      />

      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => {
        if (!open) {
          setCustomerName('');
          setSelectedTable(null);
        }
      }}>
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
              <Label htmlFor="customerName">Nome do cliente</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="h-12 rounded-2xl"
                placeholder="Ex: Mesa do João"
              />
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
              <Button variant="outline" className="rounded-2xl" onClick={() => {
                setCustomerName('');
                setSelectedTable(null);
              }} disabled={submitting}>
                Cancelar
              </Button>
              <Button className="rounded-2xl bg-[#FF6400] hover:bg-[#E25A00]" onClick={handleOpenSession} disabled={submitting}>
                {submitting ? 'Abrindo...' : 'Entrar no atendimento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stoneSettingsOpen} onOpenChange={setStoneSettingsOpen}>
        <DialogContent className="rounded-[28px] border-0 p-4 sm:max-w-xl">
          <DialogTitle className="text-2xl font-semibold text-[#082F23]">Configuracoes Stone</DialogTitle>
          <DialogDescription>Confira se o POS Android esta pronto para receber PIX, debito e credito.</DialogDescription>
          <StoneIntegrationPanel />
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
