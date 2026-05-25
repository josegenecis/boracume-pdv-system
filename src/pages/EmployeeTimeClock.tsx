import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, LogOut, MapPin, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import {
  getTimeClockStatus,
  loadWaiterWebSession,
  logoutWaiterWeb,
  punchTimeClock,
  TimeClockEventType,
  TimeClockStatus,
  WaiterWebStoredSession,
} from '@/services/waiterWebClient';

const actionLabels: Record<TimeClockEventType, string> = {
  clock_in: 'Bater entrada',
  break_start: 'Iniciar intervalo',
  break_end: 'Voltar do intervalo',
  clock_out: 'Bater saída',
};

const historyLabels: Record<TimeClockEventType, string> = {
  clock_in: 'Entrada',
  break_start: 'Intervalo',
  break_end: 'Retorno',
  clock_out: 'Saída',
};

const getDeviceFingerprint = () => {
  const key = 'employee_time_clock_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, created);
  return created;
};

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este aparelho nao liberou GPS para o navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

export default function EmployeeTimeClock() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<WaiterWebStoredSession | null>(null);
  const [timeClock, setTimeClock] = useState<TimeClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = async (showSpinner = false) => {
    if (showSpinner) setSyncing(true);
    try {
      const status = await getTimeClockStatus();
      setTimeClock(status);
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel carregar o ponto.');
      if (message.toLowerCase().includes('sess')) {
        await logoutWaiterWeb();
        navigate('/funcionario-login', { replace: true });
        return;
      }
      toast({ title: 'Erro ao atualizar ponto', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    loadWaiterWebSession().then((loadedSession) => {
      if (!mounted) return;
      if (!loadedSession) {
        navigate('/funcionario-login', { replace: true });
        return;
      }
      setSession(loadedSession);
      void loadStatus(false);
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await logoutWaiterWeb();
    navigate('/funcionario-login', { replace: true });
  };

  const handlePunch = async () => {
    if (!timeClock) return;
    setPunching(true);
    try {
      const position = timeClock.settings.requireLocation ? await getCurrentPosition() : null;
      const response = await punchTimeClock({
        eventType: timeClock.nextEventType,
        latitude: position?.coords.latitude ?? null,
        longitude: position?.coords.longitude ?? null,
        accuracyMeters: position?.coords.accuracy ?? null,
        deviceFingerprint: getDeviceFingerprint(),
        deviceLabel: navigator.platform || 'Aparelho do funcionario',
        deviceMetadata: {
          language: navigator.language,
          platform: navigator.platform,
        },
        faceVerification: {
          status: timeClock.settings.requireFaceLiveness ? 'pending_review' : 'verified',
          metadata: {
            provider: timeClock.settings.faceProvider,
            source: 'employee_time_clock_web',
          },
        },
      });

      setTimeClock(response.status);
      toast({
        title: response.event.status === 'approved' ? 'Ponto registrado' : 'Ponto enviado para revisão',
        description: response.event.review_reason || `${historyLabels[response.event.event_type]} salva com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: 'Nao foi possivel bater ponto',
        description: error?.message || 'Confira a permissao de localizacao e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setPunching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#06271D]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#A4D65E]/15 border-t-[#FF6400]" />
      </div>
    );
  }

  if (!session || !timeClock) return null;

  return (
    <div className="min-h-[100dvh] bg-[#F7F8F2] text-[#063B2A]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-4 py-4">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full border-[#DCE6DF] bg-white"
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 rounded-[32px] bg-[radial-gradient(circle_at_top,#0B5A3E_0%,#073B2B_52%,#06271D_100%)] p-5 text-white shadow-[0_30px_80px_-45px_rgba(0,50,35,0.75)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9FF9B]">
                <Clock3 className="h-3.5 w-3.5" />
                Ponto digital
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">{actionLabels[timeClock.nextEventType]}</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">{session.profile.name}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => void loadStatus(true)}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <Button
            className="mt-6 h-16 w-full rounded-[24px] bg-[#FF6400] text-lg font-bold text-white shadow-[0_18px_38px_-24px_rgba(255,100,0,0.95)] hover:bg-[#E25A00]"
            disabled={punching || !timeClock.settings.enabled}
            onClick={() => void handlePunch()}
          >
            {punching ? 'Validando localizacao...' : actionLabels[timeClock.nextEventType]}
          </Button>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3">
              <MapPin className="h-4 w-4 text-[#D9FF9B]" />
              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">Raio</div>
              <div className="text-sm font-bold">{timeClock.settings.allowedRadiusMeters}m</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <ShieldCheck className="h-4 w-4 text-[#D9FF9B]" />
              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">Facial</div>
              <div className="text-sm font-bold">{timeClock.settings.requireFaceLiveness ? 'Exigido' : 'Opcional'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <Smartphone className="h-4 w-4 text-[#D9FF9B]" />
              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/45">Aparelho</div>
              <div className="text-sm font-bold">{timeClock.settings.requireDeviceBinding ? 'Vinculado' : 'Livre'}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#E2E7DD] bg-white p-4 shadow-[0_20px_60px_-45px_rgba(0,50,35,0.45)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Pontos de hoje</h2>
            <span className="rounded-full bg-[#F4FAEC] px-3 py-1 text-xs font-semibold text-[#245B2B]">
              {timeClock.todayEvents.length} registros
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {timeClock.todayEvents.length > 0 ? (
              timeClock.todayEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-2xl bg-[#F8FAF7] px-4 py-3">
                  <div>
                    <div className="font-semibold">{historyLabels[event.event_type]}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {event.status === 'approved' ? 'Aprovado' : event.status === 'rejected' ? 'Rejeitado' : 'Em revisão'}
                      {event.distance_meters != null ? ` • ${Math.round(Number(event.distance_meters))}m` : ''}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-[#063B2A]">
                    {new Date(event.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[#F8FAF7] px-4 py-8 text-center text-sm text-slate-500">
                Nenhum ponto registrado hoje.
              </div>
            )}
          </div>
        </div>

        <p className="mt-auto py-5 text-center text-xs leading-5 text-slate-500">
          A localização é usada somente no momento da batida de ponto.
        </p>
      </div>
    </div>
  );
}
