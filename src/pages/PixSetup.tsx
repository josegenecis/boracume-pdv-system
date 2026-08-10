import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { ArrowRight, CheckCircle2, CreditCard, ExternalLink, LockKeyhole, QrCode, ShieldCheck, Smartphone, Store, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const POPPAY_TERMS_VERSION = '2026-07-v4';
const POPPAY_FEATURES: ReadonlyArray<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: QrCode, title: 'QR Code imediato', description: 'Cobrança criada no checkout' },
  { icon: CheckCircle2, title: 'Baixa automática', description: 'Pedido atualizado ao pagar' },
  { icon: LockKeyhole, title: 'Conexão segura', description: 'Autorização oficial Mercado Pago' },
];

export default function PixSetup() {
  const { user } = useAuth();
  const activeUserId = user?.id || '';

  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [mpPdvEnabled, setMpPdvEnabled] = useState<boolean>(false);
  const [mpWaiterEnabled, setMpWaiterEnabled] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popPayLoading, setPopPayLoading] = useState(false);
  const [popPayConfigured, setPopPayConfigured] = useState(false);
  const [popPayConnected, setPopPayConnected] = useState(false);
  const [popPayExpiresAt, setPopPayExpiresAt] = useState('');
  const [popPayConnectedAt, setPopPayConnectedAt] = useState('');
  const [cardOnlineReady, setCardOnlineReady] = useState(false);
  const [bundledTermsCurrent, setBundledTermsCurrent] = useState(false);
  const [popPayStatusLoaded, setPopPayStatusLoaded] = useState(false);
  const reconnectBaselineRef = useRef('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [connectPixEnabled, setConnectPixEnabled] = useState(true);
  const [connectCreditEnabled, setConnectCreditEnabled] = useState(true);
  const [awaitingExternalAuth, setAwaitingExternalAuth] = useState(false);
  const [creditOnlineEnabled, setCreditOnlineEnabled] = useState(false);
  const [creditTermsOpen, setCreditTermsOpen] = useState(false);
  const [creditTermsAccepted, setCreditTermsAccepted] = useState(false);
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditFeePercent, setCreditFeePercent] = useState(0.5);
  const creditFeeLabel = creditFeePercent.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });

  useEffect(() => {
    const load = async () => {
      if (!activeUserId) return;
      try {
        console.log('Carregando configurações Pix para usuário:', activeUserId);
        const { data, error } = await (supabase as any)
          .from('pix_settings')
          .select('enabled, mp_pdv_enabled, mp_waiter_enabled')
          .eq('user_id', activeUserId)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar configurações:', error);
          toast({ 
            title: 'Erro ao carregar', 
            description: error.message, 
            variant: 'destructive' 
          });
          return;
        }

        console.log('Dados carregados:', data);

        if (data) {
          setEnabled(!!data.enabled);
          setMpPdvEnabled(Boolean((data as any)?.mp_pdv_enabled));
          setMpWaiterEnabled(Boolean((data as any)?.mp_waiter_enabled));
        }
      } catch (e) {
        console.error('Exceção ao carregar:', e);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [activeUserId]);

  const loadPopPay = useCallback(async () => {
    if (!activeUserId) return;
    try {
      const { data } = await invokeEdgeFunction('poppay-settings', { action: 'status' }, { timeoutMs: 20000 });
      setPopPayConfigured(Boolean(data?.configured));
      setPopPayConnected(data?.connection?.status === 'connected' && data?.connection?.enabled !== false);
      setPopPayExpiresAt(String(data?.connection?.expires_at || ''));
      setPopPayConnectedAt(String(data?.connection?.connected_at || ''));
      setCardOnlineReady(data?.connection?.card_online_ready === true);
      setBundledTermsCurrent(data?.connection?.bundled_terms_current === true);
      setCreditOnlineEnabled(data?.connection?.credit_online_enabled === true);
      setCreditFeePercent(Number(data?.connection?.credit_fee_bps ?? 50) / 100);
    } finally {
      setPopPayStatusLoaded(true);
    }
  }, [activeUserId]);

  useEffect(() => {
    void loadPopPay();
  }, [loadPopPay]);

  useEffect(() => {
    if (!awaitingExternalAuth) return;
    let cancelled = false;
    let attempts = 0;
    const checkConnection = async () => {
      attempts += 1;
      const { data } = await invokeEdgeFunction('poppay-settings', { action: 'status' }, { timeoutMs: 20000 });
      if (cancelled) return;
      const connected = data?.connection?.status === 'connected' && data?.connection?.enabled !== false;
      const connectedAt = String(data?.connection?.connected_at || '');
      const isNewAuthorization = !reconnectBaselineRef.current || connectedAt !== reconnectBaselineRef.current;
      if (connected && isNewAuthorization) {
        setPopPayConnected(true);
        setPopPayExpiresAt(String(data?.connection?.expires_at || ''));
        setPopPayConnectedAt(connectedAt);
        setCardOnlineReady(data?.connection?.card_online_ready === true);
        setBundledTermsCurrent(data?.connection?.bundled_terms_current === true);
        setCreditOnlineEnabled(data?.connection?.credit_online_enabled === true);
        setCreditFeePercent(Number(data?.connection?.credit_fee_bps ?? 50) / 100);
        setAwaitingExternalAuth(false);
        toast({ title: 'PopPay conectado', description: 'A autorização foi concluída no navegador e o aplicativo já foi atualizado.' });
      } else if (attempts >= 100) {
        setAwaitingExternalAuth(false);
      }
    };
    const timer = window.setInterval(() => void checkConnection(), 3000);
    void checkConnection();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [awaitingExternalAuth, toast]);

  const connectPopPay = () => {
    setTermsAccepted(false);
    setConnectPixEnabled(true);
    setConnectCreditEnabled(true);
    setTermsOpen(true);
  };

  const confirmConnectPopPay = async () => {
    if (!termsAccepted) return;
    if (!connectPixEnabled && !connectCreditEnabled) {
      toast({ title: 'Selecione uma forma de pagamento', description: 'Ative PIX ou cartão online para continuar.', variant: 'destructive' });
      return;
    }
    setPopPayLoading(true);
    try {
      if (popPayConnected && (!connectCreditEnabled || cardOnlineReady)) {
        const { data, status } = await invokeEdgeFunction('poppay-settings', {
          action: 'accept_checkout_bundle',
          acceptedTerms: true,
          termsVersion: POPPAY_TERMS_VERSION,
          enablePix: connectPixEnabled,
          enableCreditOnline: connectCreditEnabled,
        }, { timeoutMs: 30000 });
        if (status < 400 && data?.ok) {
          setEnabled(connectPixEnabled);
          setCreditOnlineEnabled(connectCreditEnabled);
          setBundledTermsCurrent(true);
          setTermsOpen(false);
          setTermsAccepted(false);
          toast({ title: 'Checkout PopPay ativado', description: 'PIX e cartão online já estão configurados conforme sua escolha.' });
          return;
        }
        if (data?.error !== 'reconnect_required') {
          throw new Error(data?.message || data?.error || 'Não foi possível ativar o checkout.');
        }
      }

      reconnectBaselineRef.current = popPayConnected ? popPayConnectedAt : '';
      const { data, status } = await invokeEdgeFunction('poppay-oauth-start', {
        acceptedTerms: true,
        termsVersion: POPPAY_TERMS_VERSION,
        enablePix: connectPixEnabled,
        enableCreditOnline: connectCreditEnabled,
      }, { timeoutMs: 60000 });
      if (status >= 400 || !data?.ok || !data?.url) throw new Error(data?.message || data?.error || 'Não foi possível iniciar o PopPay.');
      const authorizationUrl = String(data.url);
      const desktopApi = window.electronAPI;
      if (desktopApi?.isElectron && desktopApi.openExternal) {
        const result = await desktopApi.openExternal(authorizationUrl);
        if (!result?.success) throw new Error(result?.error || 'Não foi possível abrir o navegador.');
        setAwaitingExternalAuth(true);
        setTermsOpen(false);
        toast({ title: 'Continue no navegador', description: 'Depois de autorizar o Mercado Pago, volte ao PopSystem. Esta tela será atualizada automaticamente.' });
      } else {
        window.location.href = authorizationUrl;
      }
    } catch (error: unknown) {
      toast({ title: 'PopPay indisponível', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setPopPayLoading(false);
    }
  };

  useEffect(() => {
    if (!popPayStatusLoaded || !popPayConnected || bundledTermsCurrent || termsOpen) return;
    const promptKey = `poppay-bundle-prompt:${activeUserId}:${POPPAY_TERMS_VERSION}`;
    if (window.sessionStorage.getItem(promptKey) === 'dismissed') return;
    setConnectPixEnabled(true);
    setConnectCreditEnabled(true);
    setTermsAccepted(false);
    setTermsOpen(true);
  }, [activeUserId, bundledTermsCurrent, popPayConnected, popPayStatusLoaded, termsOpen]);

  const save = async () => {
    if (!activeUserId) {
      toast({ title: 'Faça login', description: 'Entre no sistema para salvar a chave PIX.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      console.log('Salvando configurações Pix (Upsert)...', { user_id: activeUserId });
      
      const payload = {
        user_id: activeUserId,
        enabled: !!enabled,
        bank: 'mercadopago',
        mp_pdv_enabled: !!mpPdvEnabled,
        mp_waiter_enabled: !!mpWaiterEnabled,
        updated_at: new Date().toISOString(),
      };

      // Usar upsert para simplificar e evitar erros de "check existence"
      const result = await (supabase as any)
        .from('pix_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select();

      if (result.error) throw result.error;

      console.log('Salvo com sucesso:', result.data);
      toast({ title: 'Configurações salvas', description: 'PopPay configurado para o restaurante.' });
    } catch (e: any) {
      console.error('Erro detalhado ao salvar:', e);
      toast({ 
        title: 'Erro ao salvar', 
        description: `Erro: ${e.message || 'Desconhecido'} ${e.details ? `(${e.details})` : ''} ${e.hint ? `- Dica: ${e.hint}` : ''}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const setCreditOnline = async (nextEnabled: boolean) => {
    if (nextEnabled) {
      setCreditTermsAccepted(false);
      setCreditTermsOpen(true);
      return;
    }
    setCreditSaving(true);
    try {
      const { data, status } = await invokeEdgeFunction('poppay-settings', {
        action: 'set_credit_online',
        enabled: false,
      }, { timeoutMs: 30000 });
      if (status >= 400 || !data?.ok) throw new Error(data?.message || data?.error || 'Não foi possível desativar.');
      setCreditOnlineEnabled(false);
      toast({ title: 'Crédito online desativado', description: 'Os clientes não verão mais essa opção no cardápio.' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setCreditSaving(false);
    }
  };

  const confirmCreditOnline = async () => {
    if (!creditTermsAccepted) return;
    setCreditSaving(true);
    try {
      const { data, status } = await invokeEdgeFunction('poppay-settings', {
        action: 'set_credit_online',
        enabled: true,
        acceptedTerms: true,
        termsVersion: POPPAY_TERMS_VERSION,
      }, { timeoutMs: 30000 });
      if (status >= 400 || !data?.ok) throw new Error(data?.message || data?.error || 'Não foi possível ativar.');
      setCreditOnlineEnabled(true);
      setCreditFeePercent(Number(data?.connection?.credit_fee_bps ?? 50) / 100);
      setCreditTermsOpen(false);
      setCreditTermsAccepted(false);
      toast({ title: 'Crédito online ativado', description: 'O pagamento à vista já pode ser exibido no cardápio digital.' });
    } catch (error) {
      toast({ title: 'Erro ao ativar', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setCreditSaving(false);
    }
  };

  useEffect(() => {
    if (!loaded || !activeUserId) return;
    if (!popPayConnected) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const payload = {
            user_id: activeUserId,
            enabled: !!enabled,
            bank: 'mercadopago',
            mp_pdv_enabled: !!mpPdvEnabled,
            mp_waiter_enabled: !!mpWaiterEnabled,
            updated_at: new Date().toISOString(),
          };

          const result = await (supabase as any)
            .from('pix_settings')
            .upsert(payload, { onConflict: 'user_id' })
            .select();

          if (result.error) throw result.error;
        } catch (e: any) {
          toast({
            title: 'Erro ao salvar',
            description: e?.message || 'Não foi possível salvar as configurações.',
            variant: 'destructive',
          });
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [loaded, activeUserId, popPayConnected, enabled, mpPdvEnabled, mpWaiterEnabled]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card className="overflow-hidden border-emerald-200 bg-white shadow-xl shadow-emerald-950/5">
        <CardHeader className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 px-6 py-8 text-white sm:px-8">
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" aria-hidden="true" />
          <div className="relative">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider"><ShieldCheck className="h-4 w-4" />Pagamentos protegidos</span>
            <CardTitle className="flex items-center gap-3 text-3xl font-black"><WalletCards className="h-8 w-8" />PopPay</CardTitle>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50">PIX e crédito online integrados: receba, confirme, concilie e devolva pagamentos sem sair do PopSystem.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {POPPAY_FEATURES.map(({ icon: FeatureIcon, title, description }) => (
              <div key={title} className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4">
                <FeatureIcon className="h-5 w-5 text-orange-500" aria-hidden="true" />
                <p className="mt-3 font-bold text-emerald-950">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${popPayConnected ? 'bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]' : 'bg-slate-300'}`} aria-hidden="true" />
              <div>
                <p className="font-bold text-emerald-950">{popPayConnected ? 'PopPay conectado e pronto' : 'Conecte sua conta Mercado Pago'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {popPayConnected
                    ? `Recebimentos disponíveis.${popPayExpiresAt ? ` Autorização válida até ${new Date(popPayExpiresAt).toLocaleDateString('pt-BR')}.` : ''}`
                    : popPayConfigured ? 'A conexão segura leva poucos segundos.' : 'A aplicação PopPay ainda aguarda as credenciais de produção.'}
                </p>
              </div>
            </div>
            <Button onClick={connectPopPay} disabled={popPayLoading || awaitingExternalAuth || !popPayConfigured} className="bg-emerald-700 shadow-md hover:bg-emerald-800">
              {awaitingExternalAuth ? 'Aguardando autorização...' : popPayConnected ? 'Reconectar' : 'Conectar PopPay'}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 sm:p-6">
            <div className="mb-5"><h2 className="text-lg font-bold text-emerald-950">Onde deseja receber com PopPay?</h2><p className="mt-1 text-sm text-muted-foreground">Ative os canais usados pelo restaurante.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-white p-4">
                  <Store className="mb-3 h-5 w-5 text-orange-500" />
                  <Label htmlFor="poppay-online">Ativar PIX online (PopPay)</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch id="poppay-online" checked={enabled} onCheckedChange={setEnabled} disabled={!popPayConnected} />
                    <span className="text-sm text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Exibe o pagamento imediato no Cardápio Digital.</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <CreditCard className="mb-3 h-5 w-5 text-orange-500" />
                  <Label htmlFor="poppay-credit-online">Aceitar crédito online</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch
                      id="poppay-credit-online"
                      checked={creditOnlineEnabled}
                      onCheckedChange={(checked) => void setCreditOnline(checked)}
                      disabled={!popPayConnected || !cardOnlineReady || creditSaving}
                    />
                    <span className="text-sm text-muted-foreground">{creditOnlineEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Somente crédito à vista. Tarifa Mercado Pago + {creditFeeLabel}% PopPay sobre o recebível.
                  </p>
                  {popPayConnected && !cardOnlineReady ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Reconecte o PopPay uma única vez para liberar o cartão online. O PIX atual continua funcionando.
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <WalletCards className="mb-3 h-5 w-5 text-orange-500" />
                  <Label htmlFor="poppay-pdv">Ativar PopPay no PDV</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch id="poppay-pdv" checked={mpPdvEnabled} onCheckedChange={setMpPdvEnabled} disabled={!popPayConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpPdvEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <Smartphone className="mb-3 h-5 w-5 text-orange-500" />
                  <Label htmlFor="poppay-waiter">Gerar QR Code PopPay no App Garçom</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch id="poppay-waiter" checked={mpWaiterEnabled} onCheckedChange={setMpWaiterEnabled} disabled={!popPayConnected || !enabled} />
                    <span className="text-sm text-muted-foreground">{mpWaiterEnabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Quando ativo, o garçom pode receber PIX online por QR Code no celular ou no app web.
                  </p>
                </div>
            </div>
              {!popPayConnected ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Conecte o PopPay para habilitar o PIX online.
                </p>
              ) : null}
          </div>
          <div className="flex gap-4 border-t border-emerald-100 pt-4">
            <Button onClick={save} disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600">
              {loading ? 'Processando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={termsOpen} onOpenChange={(open) => {
        setTermsOpen(open);
        if (!open) {
          setTermsAccepted(false);
          if (popPayConnected && !bundledTermsCurrent) {
            window.sessionStorage.setItem(
              `poppay-bundle-prompt:${activeUserId}:${POPPAY_TERMS_VERSION}`,
              'dismissed',
            );
          }
        }
      }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-0 p-0">
          <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 p-6 text-white sm:p-8">
            <DialogHeader>
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck className="h-6 w-6" /></span>
              <DialogTitle className="text-2xl font-black">{popPayConnected ? 'Ative o checkout completo do PopPay' : 'Antes de conectar o PopPay'}</DialogTitle>
              <DialogDescription className="text-emerald-50">PIX e cartão online já vêm selecionados. Confira as condições e altere se desejar.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 p-6 sm:px-8">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Ao continuar, você autoriza o PopSystem/PopPay a conectar sua conta Mercado Pago para criar, consultar, conciliar e solicitar devoluções de pagamentos iniciados no sistema.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setConnectPixEnabled((current) => !current)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setConnectPixEnabled((current) => !current);
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${connectPixEnabled ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white"><QrCode className="h-5 w-5" /></span>
                    <Switch
                      checked={connectPixEnabled}
                      onCheckedChange={setConnectPixEnabled}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Ativar PIX no PopPay"
                    />
                  </span>
                  <span className="mt-4 block font-bold text-emerald-950">PIX online</span>
                  <span className="mt-1 block text-xl font-black text-emerald-700">1,99%</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">Tarifa integrada por transação. Confirmação e recebimento instantâneos após o pagamento.</span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setConnectCreditEnabled((current) => !current)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setConnectCreditEnabled((current) => !current);
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${connectCreditEnabled ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white"><CreditCard className="h-5 w-5" /></span>
                    <Switch
                      checked={connectCreditEnabled}
                      onCheckedChange={setConnectCreditEnabled}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Ativar cartão online no PopPay"
                    />
                  </span>
                  <span className="mt-4 block font-bold text-emerald-950">Cartão online • crédito à vista</span>
                  <span className="mt-1 block text-xl font-black text-orange-600">Tarifa MP + {creditFeeLabel}%</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">Pagamento confirmado na hora. O saldo fica disponível conforme o prazo contratado na conta Mercado Pago.</span>
                </div>
              </div>
              <ul className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
                <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />O restaurante continua sendo o recebedor das vendas em sua própria conta Mercado Pago.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />As tarifas são descontadas do recebível e não aumentam o valor pago pelo consumidor.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Não há parcelamento no cartão online.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Os canais podem ser desativados posteriormente.</li>
              </ul>
            </div>
            <div className="flex gap-4 rounded-2xl border border-slate-200 p-4">
              <Checkbox id="poppay-terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" />
              <Label htmlFor="poppay-terms" className="cursor-pointer text-sm font-normal leading-6 text-slate-700">
                Li e concordo com os <a href="/termos#poppay" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">Termos de Uso do PopPay <ExternalLink className="inline h-3 w-3" /></a> e com a <a href="/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">Política de Privacidade</a>.
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">O aceite da versão {POPPAY_TERMS_VERSION}, os canais escolhidos, as taxas apresentadas, o usuário, a data e a hora serão registrados.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTermsOpen(false)}>Cancelar</Button>
              <Button onClick={confirmConnectPopPay} disabled={!termsAccepted || popPayLoading || (!connectPixEnabled && !connectCreditEnabled)} className="bg-emerald-700 hover:bg-emerald-800">
                {popPayLoading ? 'Preparando...' : popPayConnected && cardOnlineReady ? 'Aceitar e ativar' : 'Aceitar e conectar'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={creditTermsOpen} onOpenChange={(open) => {
        if (!creditSaving) setCreditTermsOpen(open);
        if (!open) setCreditTermsAccepted(false);
      }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-0 p-0">
          <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 p-6 text-white sm:p-8">
            <DialogHeader>
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><CreditCard className="h-6 w-6" /></span>
              <DialogTitle className="text-2xl font-black">Ativar crédito online</DialogTitle>
              <DialogDescription className="text-emerald-50">Esta modalidade é opcional e pode ser desativada a qualquer momento.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 p-6 sm:px-8">
            <ul className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Serão aceitos somente pagamentos no cartão de crédito à vista (1x).</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Não haverá parcelamento no checkout.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Será descontada a tarifa de processamento definida pelo Mercado Pago para a conta conectada.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />Além dela, será descontada a tarifa operacional PopPay de {creditFeeLabel}% por transação aprovada.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />As tarifas incidem sobre o recebível do restaurante e não aumentam o valor pago pelo consumidor.</li>
            </ul>
            <div className="flex gap-4 rounded-2xl border border-slate-200 p-4">
              <Checkbox id="poppay-credit-terms" checked={creditTermsAccepted} onCheckedChange={(checked) => setCreditTermsAccepted(checked === true)} className="mt-0.5" />
              <Label htmlFor="poppay-credit-terms" className="cursor-pointer text-sm font-normal leading-6 text-slate-700">
                Li e aceito as condições do crédito online descritas nos <a href="/termos#poppay" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">Termos de Uso do PopPay <ExternalLink className="inline h-3 w-3" /></a>.
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">O aceite da versão {POPPAY_TERMS_VERSION}, incluindo a tarifa PopPay de {creditFeeLabel}%, será registrado com usuário, data e hora.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreditTermsOpen(false)} disabled={creditSaving}>Agora não</Button>
              <Button onClick={confirmCreditOnline} disabled={!creditTermsAccepted || creditSaving} className="bg-emerald-700 hover:bg-emerald-800">
                {creditSaving ? 'Ativando...' : 'Aceitar e ativar'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
