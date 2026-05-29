import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, Clock3, LogOut, MapPin, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import {
  authenticateEmployeeFaceio,
  enrollEmployeeFaceio,
  extractFaceioFacialId,
  isFaceioDuplicateError,
  prepareFaceio,
} from '@/services/faceioClient';
import {
  getTimeClockStatus,
  loadWaiterWebSession,
  logoutWaiterWeb,
  punchTimeClock,
  saveWaiterFaceioEnrollment,
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

type FaceCaptureFrame = {
  step: string;
  dataUrl: string;
  capturedAt: string;
  faceDetected?: boolean;
  faceBox?: { x: number; y: number; width: number; height: number } | null;
};

type FaceCapturePayload = {
  challengeId: string;
  challengePrompt: string;
  privacyAcknowledgedAt?: string;
  frames: FaceCaptureFrame[];
  clientChecks: {
    cameraPermission: boolean;
    faceDetectorAvailable: boolean;
    detectedFrames: number;
    movementScore: number;
    browserLivenessPassed: boolean;
  };
};

const faceChallenges = [
  'Centralize o rosto e pisque antes da captura.',
  'Centralize o rosto e vire levemente para a direita.',
  'Centralize o rosto e aproxime um pouco da camera.',
];

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [session, setSession] = useState<WaiterWebStoredSession | null>(null);
  const [timeClock, setTimeClock] = useState<TimeClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [faceConsent, setFaceConsent] = useState(false);
  const [faceCapture, setFaceCapture] = useState<FaceCapturePayload | null>(null);
  const [capturingFace, setCapturingFace] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceioBusy, setFaceioBusy] = useState(false);
  const [faceioDuplicateDetected, setFaceioDuplicateDetected] = useState(false);

  const useFaceio = Boolean(
    timeClock?.settings.requireFaceLiveness &&
    (
      String(timeClock.settings.faceLivenessMode || '').toLowerCase() === 'faceio' ||
      String(timeClock.settings.faceProvider || '').toLowerCase() === 'faceio'
    ),
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

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
      stopCamera();
    };
  }, [navigate]);

  useEffect(() => {
    if (!useFaceio) return;
    void prepareFaceio().catch((error) => {
      setFaceError(String(error?.message || 'Nao foi possivel preparar o FACEIO neste navegador.'));
    });
  }, [useFaceio]);

  const handleLogout = async () => {
    stopCamera();
    await logoutWaiterWeb();
    navigate('/funcionario-login', { replace: true });
  };

  const handleFaceioEnroll = async () => {
    if (!session) return;
    setFaceioBusy(true);
    setFaceError('');
    setFaceioDuplicateDetected(false);
    try {
      const response = await enrollEmployeeFaceio({
        employeeId: session.profile.id,
        restaurantId: session.profile.restaurantId,
        name: session.profile.name,
        cpf: session.profile.cpf,
        source: 'popsystem_time_clock',
      });
      const facialId = extractFaceioFacialId(response);
      if (!facialId) throw new Error('O FACEIO nao retornou o facialId do funcionario.');
      const updatedSession = await saveWaiterFaceioEnrollment({ facialId, enrollmentPayload: response });
      setSession(updatedSession);
      toast({
        title: 'Biometria cadastrada',
        description: 'O rosto deste funcionario foi vinculado ao ponto.',
      });
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel cadastrar a biometria facial.');
      if (isFaceioDuplicateError(error)) {
        setFaceioDuplicateDetected(true);
      }
      setFaceError(message);
      toast({ title: 'Erro no FACEIO', description: message, variant: 'destructive' });
    } finally {
      setFaceioBusy(false);
    }
  };

  const handleFaceioLinkExisting = async () => {
    if (!session) return;
    setFaceioBusy(true);
    setFaceError('');
    try {
      const response = await authenticateEmployeeFaceio({
        employeeId: session.profile.id,
        restaurantId: session.profile.restaurantId,
        name: session.profile.name,
        cpf: session.profile.cpf,
        source: 'popsystem_time_clock_link_existing_face',
      });
      const facialId = extractFaceioFacialId(response);
      if (!facialId) throw new Error('O FACEIO nao retornou o facialId autenticado.');
      const updatedSession = await saveWaiterFaceioEnrollment({
        facialId,
        enrollmentPayload: {
          linkedFromExistingFace: true,
          response,
        },
      });
      setSession(updatedSession);
      setFaceioDuplicateDetected(false);
      toast({
        title: 'Biometria vinculada',
        description: 'O rosto existente no FACEIO foi vinculado a este funcionario.',
      });
    } catch (error: any) {
      const message = String(error?.message || 'Nao foi possivel vincular a biometria existente.');
      setFaceError(message);
      toast({ title: 'Erro no FACEIO', description: message, variant: 'destructive' });
    } finally {
      setFaceioBusy(false);
    }
  };

  const authenticateFaceioForPunch = async () => {
    if (!session) throw new Error('Sessao do funcionario nao encontrada.');
    const response = await authenticateEmployeeFaceio({
      employeeId: session.profile.id,
      restaurantId: session.profile.restaurantId,
      source: 'popsystem_time_clock',
      eventType: timeClock?.nextEventType,
    });
    const facialId = extractFaceioFacialId(response);
    if (!facialId) throw new Error('O FACEIO nao retornou o facialId autenticado.');

    return {
      status: 'verified' as const,
      facialId,
      confidence: Number((response as any)?.confidence || (response as any)?.confidenceScore || 0) || null,
      auditId: String((response as any)?.auditId || (response as any)?.transactionId || (response as any)?.sessionId || ''),
      response,
      verifiedAt: new Date().toISOString(),
    };
  };

  const detectFace = async (canvas: HTMLCanvasElement) => {
    const FaceDetectorConstructor = (window as any).FaceDetector;
    if (!FaceDetectorConstructor) return { available: false, detected: false, box: null };
    try {
      const detector = new FaceDetectorConstructor({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(canvas);
      const box = faces?.[0]?.boundingBox;
      return {
        available: true,
        detected: Boolean(box),
        box: box
          ? {
              x: Number(box.x || 0),
              y: Number(box.y || 0),
              width: Number(box.width || 0),
              height: Number(box.height || 0),
            }
          : null,
      };
    } catch {
      return { available: false, detected: false, box: null };
    }
  };

  const captureFrame = async (step: string): Promise<{ frame: FaceCaptureFrame; detectorAvailable: boolean }> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) throw new Error('Camera ainda nao foi iniciada.');
    const width = Math.min(480, video.videoWidth || 480);
    const height = Math.round(width * ((video.videoHeight || 640) / (video.videoWidth || 480)));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Nao foi possivel preparar a captura.');
    context.drawImage(video, 0, 0, width, height);
    const face = await detectFace(canvas);
    return {
      detectorAvailable: face.available,
      frame: {
        step,
        dataUrl: canvas.toDataURL('image/jpeg', 0.72),
        capturedAt: new Date().toISOString(),
        faceDetected: face.detected,
        faceBox: face.box,
      },
    };
  };

  const buildMovementScore = (frames: FaceCaptureFrame[]) => {
    const boxes = frames.map((frame) => frame.faceBox).filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;
    if (boxes.length < 2) return 0;
    const first = boxes[0];
    const last = boxes[boxes.length - 1];
    const centerMove = Math.abs((last.x + last.width / 2) - (first.x + first.width / 2)) / Math.max(1, first.width);
    const sizeMove = Math.abs(last.width - first.width) / Math.max(1, first.width);
    return Math.max(0, Math.min(1, centerMove + sizeMove));
  };

  const startFaceCapture = async () => {
    setFaceError('');
    setFaceCapture(null);
    setCapturingFace(true);
    try {
      if (!faceConsent) {
        throw new Error('Confirme o uso da camera e da prova de vida para continuar.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador nao liberou camera para a prova de vida.');
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const challengePrompt = faceChallenges[Math.floor(Math.random() * faceChallenges.length)];
      const challengeId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      toast({ title: 'Prova de vida', description: challengePrompt });

      await new Promise((resolve) => setTimeout(resolve, 700));
      const first = await captureFrame('inicio');
      await new Promise((resolve) => setTimeout(resolve, 900));
      const second = await captureFrame('desafio');
      await new Promise((resolve) => setTimeout(resolve, 900));
      const third = await captureFrame('confirmacao');
      const frames = [first.frame, second.frame, third.frame];
      const detectedFrames = frames.filter((frame) => frame.faceDetected).length;
      const movementScore = buildMovementScore(frames);
      const detectorAvailable = first.detectorAvailable || second.detectorAvailable || third.detectorAvailable;

      setFaceCapture({
        challengeId,
        challengePrompt,
        privacyAcknowledgedAt: new Date().toISOString(),
        frames,
        clientChecks: {
          cameraPermission: true,
          faceDetectorAvailable: detectorAvailable,
          detectedFrames,
          movementScore,
          browserLivenessPassed: detectorAvailable ? detectedFrames >= 2 && movementScore >= 0.04 : false,
        },
      });
      stopCamera();
    } catch (error: any) {
      setFaceError(error?.message || 'Nao foi possivel concluir a prova de vida.');
      stopCamera();
    } finally {
      setCapturingFace(false);
    }
  };

  const handlePunch = async () => {
    if (!timeClock) return;
    if (useFaceio && !session?.profile.faceioFacialId) {
      toast({
        title: 'Biometria nao cadastrada',
        description: 'Cadastre o rosto neste aparelho antes de bater o ponto.',
        variant: 'destructive',
      });
      return;
    }
    if (timeClock.settings.requireFaceLiveness && !useFaceio && !faceCapture) {
      toast({
        title: 'Prova de vida obrigatoria',
        description: 'Capture a biometria facial antes de bater o ponto.',
        variant: 'destructive',
      });
      return;
    }
    setPunching(true);
    try {
      const faceioVerification = useFaceio ? await authenticateFaceioForPunch() : undefined;
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
        faceCapture: !useFaceio ? faceCapture || undefined : undefined,
        faceioVerification,
      });

      setTimeClock(response.status);
      setFaceCapture(null);
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
            {punching ? 'Validando ponto...' : actionLabels[timeClock.nextEventType]}
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

        {useFaceio && (
          <div className="mt-5 rounded-[22px] border border-[#E2E7DD] bg-white p-4 shadow-[0_20px_60px_-45px_rgba(0,50,35,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Biometria FACEIO</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {session.profile.faceioFacialId
                    ? 'Ao registrar o ponto, o FACEIO abre a câmera e valida o rosto automaticamente.'
                    : 'Cadastre o rosto uma vez para liberar as batidas com prova de vida.'}
                </p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${session.profile.faceioFacialId ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {session.profile.faceioFacialId ? 'Cadastrada' : 'Cadastrar'}
              </div>
            </div>

            {faceError && (
              <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{faceError}</div>
            )}

            {!session.profile.faceioFacialId && (
              <div className="mt-4 space-y-2">
                <Button
                  className="h-12 w-full rounded-2xl bg-[#FF6400] font-bold text-white hover:bg-[#E25A00]"
                  disabled={faceioBusy || punching}
                  onClick={() => void handleFaceioEnroll()}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {faceioBusy ? 'Abrindo FACEIO...' : 'Cadastrar biometria facial'}
                </Button>
                {faceioDuplicateDetected && (
                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-[#003223]/20 font-bold text-[#003223]"
                    disabled={faceioBusy || punching}
                    onClick={() => void handleFaceioLinkExisting()}
                  >
                    Vincular rosto já cadastrado
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {timeClock.settings.requireFaceLiveness && !useFaceio && (
          <div className="mt-5 rounded-[28px] border border-[#E2E7DD] bg-white p-4 shadow-[0_20px_60px_-45px_rgba(0,50,35,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Prova de vida facial</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  A camera registra somente a evidencia desta batida. O responsavel revisa quando nao houver provedor facial conectado.
                </p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${faceCapture ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {faceCapture ? 'Pronta' : 'Pendente'}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[22px] bg-[#06271D]">
              <video ref={videoRef} className={`${cameraActive ? 'block' : 'hidden'} aspect-[4/5] w-full scale-x-[-1] object-cover`} muted playsInline />
              {!cameraActive && (
                <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 text-white/70">
                  {faceCapture ? <CheckCircle2 className="h-10 w-10 text-[#A4D65E]" /> : <Camera className="h-10 w-10 text-white/50" />}
                  <span className="text-sm">{faceCapture ? faceCapture.challengePrompt : 'Camera pronta para captura'}</span>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#F8FAF7] p-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={faceConsent}
                onChange={(event) => setFaceConsent(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#063B2A]"
              />
              <span>{timeClock.settings.policyNotice || 'Autorizo o uso da camera e da prova de vida somente para validar este registro de ponto.'}</span>
            </label>

            {faceError && (
              <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{faceError}</div>
            )}

            <Button
              variant="outline"
              className="mt-4 h-12 w-full rounded-2xl border-[#DCE6DF] bg-white font-bold"
              disabled={capturingFace || punching}
              onClick={() => void startFaceCapture()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {capturingFace ? 'Capturando...' : faceCapture ? 'Refazer prova de vida' : 'Capturar prova de vida'}
            </Button>
          </div>
        )}

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
