import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import {
  ArrowRight, Bike, CheckCircle2, CircleDollarSign, Clock3, GripVertical, LogOut,
  Download, MapPin, Navigation, PackageCheck, RefreshCw, Route, Store, Wallet, WifiOff,
  Volume2, VolumeX, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  acceptDeliveryOffer, DeliveryAssignment, DeliveryOffer, loadMotoboyBootstrap, loadMotoboySession,
  logoutMotoboy, MotoboyBootstrap, reorderDeliveries, sendDriverLocation, setMotoboyAvailability,
  updateDeliveryStage,
} from '@/services/motoboyWebClient';
import { useMotoboyPwa } from '@/hooks/useMotoboyPwa';

const money = (value = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const orderNumber = (order: { order_number?: string | null; id: string }) => order.order_number || order.id.slice(0, 8).toUpperCase();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.';

function destination(order: DeliveryAssignment['order'] | DeliveryOffer['order']) {
  return [order.customer_address, order.customer_neighborhood].filter(Boolean).join(' • ') || 'Endereço não informado';
}

function openNavigation(order: DeliveryAssignment['order']) {
  const coordinates = Number.isFinite(Number(order.customer_latitude)) && Number.isFinite(Number(order.customer_longitude))
    ? `${order.customer_latitude},${order.customer_longitude}` : '';
  const query = coordinates || [order.customer_address, order.customer_neighborhood].filter(Boolean).join(', ');
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
}

const MotoboyApp: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const pwa = useMotoboyPwa();
  const [data, setData] = useState<MotoboyBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [online, setOnline] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('popsystem_motoboy_sound') !== 'off');
  const [soundReady, setSoundReady] = useState(false);
  const lastOfferIds = useRef<Set<string>>(new Set());
  const offersInitialized = useRef(false);
  const lastCancellationIds = useRef<Set<string>>(new Set());
  const cancellationsInitialized = useRef(false);
  const refreshInFlight = useRef(false);
  const offerAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastLocationSentAt = useRef(0);

  useEffect(() => {
    const audio = new Audio('/sounds/Toque%20PopSystem.mp3');
    audio.preload = 'auto';
    audio.volume = 0.95;
    offerAudioRef.current = audio;
    return () => {
      audio.pause();
      offerAudioRef.current = null;
    };
  }, []);

  const playOfferSound = useCallback(async () => {
    if (!soundEnabled || !offerAudioRef.current) return;
    try {
      offerAudioRef.current.currentTime = 0;
      await offerAudioRef.current.play();
    } catch {
      // iOS e alguns Androids exigem um toque do usuário; o botão Som faz esse desbloqueio.
    }
  }, [soundEnabled]);

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('popsystem_motoboy_sound', next ? 'on' : 'off');
    if (next) {
      if (offerAudioRef.current) {
        offerAudioRef.current.currentTime = 0;
        const played = await offerAudioRef.current.play().then(() => true).catch(() => false);
        setSoundReady(played);
      }
      toast({ title: 'Som ativado', description: 'Este será o toque das novas entregas.' });
    } else {
      offerAudioRef.current?.pause();
      setSoundReady(false);
      toast({ title: 'Som desativado' });
    }
  };

  const activateAlerts = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => undefined);
    }
    if (!offerAudioRef.current) return;
    offerAudioRef.current.currentTime = 0;
    const played = await offerAudioRef.current.play().then(() => true).catch(() => false);
    setSoundReady(played);
    toast({
      title: played ? 'Alertas sonoros ativados' : 'O celular bloqueou o som',
      description: played ? 'O toque de teste foi reproduzido com sucesso.' : 'Retire o aparelho do silencioso, aumente o volume e tente novamente.',
      variant: played ? 'default' : 'destructive',
    });
  };

  const refresh = useCallback(async (silent = false) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const next = await loadMotoboyBootstrap();
      setData(next);
      setOnline(next.profile.status !== 'offline');
      const newOffer = next.offers.find((offer) => !lastOfferIds.current.has(offer.id));
      if (newOffer && offersInitialized.current) {
        navigator.vibrate?.([250, 100, 250]);
        void playOfferSound();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nova entrega disponível', { body: `Pedido ${orderNumber(newOffer.order)} • ${money(newOffer.payout_amount)}` });
        }
        toast({ title: 'Nova entrega disponível!', description: `Pedido ${orderNumber(newOffer.order)} • ${money(newOffer.payout_amount)}` });
      }
      lastOfferIds.current = new Set(next.offers.map((offer) => offer.id));
      offersInitialized.current = true;
      const cancellations = next.cancellations || [];
      const newCancellation = cancellations.find((item) => !lastCancellationIds.current.has(item.id));
      if (newCancellation && cancellationsInitialized.current) {
        navigator.vibrate?.([400, 120, 400]);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pedido cancelado', { body: `Pedido ${orderNumber(newCancellation.order)} foi retirado da sua rota.` });
        }
        toast({
          title: 'Pedido cancelado',
          description: `O pedido ${orderNumber(newCancellation.order)} foi cancelado e removido da rota.`,
          variant: 'destructive',
        });
      }
      lastCancellationIds.current = new Set(cancellations.map((item) => item.id));
      cancellationsInitialized.current = true;
    } catch (error: unknown) {
      if (!silent) toast({ title: 'Não foi possível carregar as entregas', description: errorMessage(error), variant: 'destructive' });
    } finally {
      refreshInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [playOfferSound, toast]);

  useEffect(() => {
    loadMotoboySession().then((session) => {
      if (!session) navigate('/motoboy-login', { replace: true });
      else refresh();
    });
    const interval = window.setInterval(() => refresh(true), 4000);
    return () => window.clearInterval(interval);
  }, [navigate, refresh]);

  const trackingAssignments = useMemo(() => (data?.assignments || []).filter((item) => item.status === 'picked_up'), [data?.assignments]);

  useEffect(() => {
    if (!trackingAssignments.length || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((position) => {
      if (Date.now() - lastLocationSentAt.current < 7000) return;
      lastLocationSentAt.current = Date.now();
      trackingAssignments.forEach((assignment) => sendDriverLocation(assignment.id, position.coords).catch(() => undefined));
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingAssignments]);

  const toggleOnline = async (checked: boolean) => {
    setOnline(checked);
    try {
      await setMotoboyAvailability(checked);
      if (checked && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      if (checked && soundEnabled && offerAudioRef.current) {
        offerAudioRef.current.currentTime = 0;
        const played = await offerAudioRef.current.play().then(() => true).catch(() => false);
        setSoundReady(played);
      }
      await refresh(true);
    } catch (error: unknown) {
      setOnline(!checked);
      toast({ title: 'Não foi possível alterar seu status', description: errorMessage(error), variant: 'destructive' });
    }
  };

  const accept = async (offer: DeliveryOffer) => {
    setBusyId(offer.id);
    try {
      await acceptDeliveryOffer(offer.id);
      toast({ title: 'Entrega aceita!', description: `Pedido ${orderNumber(offer.order)} adicionado à sua rota.` });
      await refresh(true);
    } catch (error: unknown) {
      toast({ title: 'A entrega não está mais disponível', description: errorMessage(error), variant: 'destructive' });
      await refresh(true);
    } finally { setBusyId(''); }
  };

  const updateStage = async (assignment: DeliveryAssignment, status: string) => {
    setBusyId(assignment.id);
    try {
      const result: any = await updateDeliveryStage(assignment.id, status);
      const messages: Record<string, string> = { arrived: 'Chegada registrada.', picked_up: 'Entrega iniciada e rastreamento processado.', delivered: 'Entrega concluída e saldo atualizado.' };
      toast({ title: messages[status] || 'Etapa atualizada' });
      if (result?.whatsapp && !result.whatsapp.ok && !result.whatsapp.skipped) {
        toast({
          title: 'Entrega atualizada, mas o WhatsApp não foi enviado',
          description: `Confira o telefone do cliente. Provedor: ${result.whatsapp.error || `HTTP ${result.whatsapp.status || 'indisponível'}`}.`,
          variant: 'destructive',
        });
      }
      await refresh(true);
    } catch (error: unknown) {
      toast({ title: 'Não foi possível atualizar', description: errorMessage(error), variant: 'destructive' });
    } finally { setBusyId(''); }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !data) return;
    const reordered = [...data.assignments];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setData({ ...data, assignments: reordered.map((item, index) => ({ ...item, route_position: index + 1 })) });
    try { await reorderDeliveries(reordered.map((item) => item.id)); }
    catch (error: unknown) { toast({ title: 'Não foi possível salvar a ordem', description: errorMessage(error), variant: 'destructive' }); await refresh(true); }
  };

  const signOut = async () => { await logoutMotoboy(); navigate('/motoboy-login', { replace: true }); };

  if (loading || !data) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f6f4]"><RefreshCw className="h-10 w-10 animate-spin text-[#08704d]" /></div>;

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f4] pb-28 text-[#083e2f]">
      <header className="sticky top-0 z-30 bg-[linear-gradient(135deg,#063e2d,#08704d)] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white shadow-lg">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-white/60">{data.restaurant?.restaurant_name || 'PopSystem'}</p><h1 className="mt-1 text-xl font-black">Olá, {data.profile.name.split(' ')[0]}</h1></div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><span className="text-sm font-bold">{online ? 'Online' : 'Offline'}</span><Switch checked={online} onCheckedChange={toggleOnline} /></div>
          <Button variant="ghost" size="icon" onClick={toggleSound} className="rounded-full text-white hover:bg-white/10 hover:text-white" aria-label={soundEnabled ? 'Desativar som das entregas' : 'Ativar som das entregas'}>{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full text-white hover:bg-white/10 hover:text-white" aria-label="Sair"><LogOut size={20} /></Button>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        {!pwa.isOnline && <div className="flex items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900"><WifiOff className="h-5 w-5" /> Sem internet. A rota atual permanece visível, mas as atualizações aguardam conexão.</div>}
        {pwa.canInstall && <Button onClick={pwa.install} variant="outline" className="h-12 w-full rounded-2xl border-[#08704d]/20 bg-white font-bold text-[#08704d]"><Download className="mr-2 h-5 w-5" /> Instalar App Motoboy</Button>}
        {soundEnabled && !soundReady && <Button onClick={activateAlerts} className="h-14 w-full rounded-2xl bg-[#ff6418] text-base font-black hover:bg-[#e85b14]"><Volume2 className="mr-2 h-5 w-5" /> Ativar e testar som das entregas</Button>}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm"><Wallet className="h-5 w-5 text-[#ff6418]" /><p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">A receber</p><p className="mt-1 text-xl font-black">{money(data.balance.pending)}</p></div>
          <div className="rounded-3xl bg-white p-4 shadow-sm"><Route className="h-5 w-5 text-[#08704d]" /><p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Na rota</p><p className="mt-1 text-xl font-black">{data.assignments.length} entrega(s)</p></div>
        </section>

        {online && data.offers.length > 0 && (
          <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Novas entregas</h2><Badge className="bg-[#ff6418]">{data.offers.length}</Badge></div>
            {data.offers.map((offer) => <article key={offer.id} className="overflow-hidden rounded-[28px] border-2 border-[#ff6418] bg-white shadow-[0_18px_40px_-25px_rgba(255,100,24,.7)]"><div className="bg-[#fff3eb] px-5 py-4"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#ff6418]">Nova corrida</p><h3 className="mt-1 text-2xl font-black">Pedido {orderNumber(offer.order)}</h3></div><div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm"><p className="text-[10px] font-bold uppercase text-slate-400">Você recebe</p><p className="font-black text-[#08704d]">{money(offer.payout_amount)}</p></div></div></div><div className="space-y-3 p-5"><p className="flex gap-3 text-sm"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#ff6418]" /><span><strong>{offer.order.customer_name || 'Cliente'}</strong><br />{destination(offer.order)}</span></p><p className="flex items-center gap-3 text-sm"><CircleDollarSign className="h-5 w-5 text-[#08704d]" />{offer.order.payment_method || 'Pagamento informado no pedido'} • {money(offer.order.total)}</p><Button disabled={busyId === offer.id} onClick={() => accept(offer)} className="h-12 w-full rounded-2xl bg-[#ff6418] text-base font-black hover:bg-[#e85b14]">{busyId === offer.id ? 'Aceitando...' : <>Aceitar entrega <ArrowRight className="ml-2" /></>}</Button></div></article>)}
          </section>
        )}

        {(data.cancellations || []).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-red-800">Pedidos cancelados</h2>
              <Badge variant="destructive">{data.cancellations.length}</Badge>
            </div>
            {data.cancellations.slice(0, 3).map((cancellation) => (
              <article key={cancellation.id} className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-red-100 p-2 text-red-700"><XCircle className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-red-600">Cancelado pelo restaurante/cliente</p>
                    <h3 className="mt-1 text-lg font-black">Pedido {orderNumber(cancellation.order)}</h3>
                    <p className="mt-1 text-sm text-red-800">Não retire nem entregue este pedido. Ele já foi removido da sua rota.</p>
                    <p className="mt-2 text-xs font-semibold text-red-500">Atualizado às {new Date(cancellation.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="text-lg font-black">Minha rota</h2><p className="text-xs text-slate-500">Arraste para reorganizar as entregas</p></div><Button variant="ghost" size="sm" onClick={() => refresh()}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button></div>
          {data.assignments.length === 0 ? <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Bike className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-black">Nenhuma entrega na rota</h3><p className="mt-1 text-sm text-slate-500">Fique online para receber novas corridas.</p></div> :
          <DragDropContext onDragEnd={onDragEnd}><Droppable droppableId="driver-route">{(provided) => <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">{data.assignments.map((assignment, index) => <Draggable key={assignment.id} draggableId={assignment.id} index={index}>{(drag) => <article ref={drag.innerRef} {...drag.draggableProps} className="rounded-[26px] bg-white p-4 shadow-sm"><div className="flex gap-3"><button type="button" {...drag.dragHandleProps} className="flex w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400" aria-label="Reordenar entrega"><GripVertical /></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-[#ff6418]">{index + 1}ª PARADA</p><h3 className="text-lg font-black">Pedido {orderNumber(assignment.order)}</h3></div><Badge variant="outline">{money(assignment.payout_amount)}</Badge></div><p className="mt-2 text-sm font-semibold">{assignment.order.customer_name || 'Cliente'}</p><p className="mt-1 text-sm leading-5 text-slate-500">{destination(assignment.order)}</p>{assignment.order.customer_address_reference && <p className="mt-1 text-xs text-slate-400">Referência: {assignment.order.customer_address_reference}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" className="rounded-xl" onClick={() => openNavigation(assignment.order)}><Navigation className="mr-2 h-4 w-4" /> Navegar</Button>{assignment.status === 'accepted' && <Button disabled={busyId === assignment.id} className="rounded-xl bg-[#08704d]" onClick={() => updateStage(assignment, 'arrived')}><Store className="mr-2 h-4 w-4" /> Cheguei</Button>}{assignment.status === 'arrived' && <Button disabled={busyId === assignment.id} className="rounded-xl bg-[#ff6418]" onClick={() => updateStage(assignment, 'picked_up')}><PackageCheck className="mr-2 h-4 w-4" /> Retirei</Button>}{assignment.status === 'picked_up' && <Button disabled={busyId === assignment.id} className="rounded-xl bg-emerald-600" onClick={() => updateStage(assignment, 'delivered')}><CheckCircle2 className="mr-2 h-4 w-4" /> Entreguei</Button>}</div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400"><Clock3 size={14} />{assignment.status === 'accepted' ? 'A caminho do restaurante' : assignment.status === 'arrived' ? 'Aguardando retirada' : 'Cliente acompanhando em tempo real'}</div></div></div></article>}</Draggable>)}{provided.placeholder}</div>}</Droppable></DragDropContext>}
        </section>
      </div>
    </main>
  );
};

export default MotoboyApp;
