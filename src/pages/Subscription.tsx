
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Clock, AlertTriangle, Crown, ArrowRight, Store, CreditCard, QrCode, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { PLAN_CATALOG, getPlanCatalogItem, type PlanCatalogItem } from '@/data/planCatalog';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const isValidCpfCnpj = (value: string) => {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
};

type PaymentMethod = 'PIX' | 'CREDIT_CARD';

type CheckoutPlan = {
  planId: number;
  storeCount: number;
  planName: string;
  value: number;
};

const emptyCardForm = {
  holderName: '',
  number: '',
  expiryMonth: '',
  expiryYear: '',
  ccv: '',
  postalCode: '',
  addressNumber: '',
  mobilePhone: '',
};

const Subscription = () => {
  const { subscription, refreshSubscription, user } = useAuth();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [storeCounts, setStoreCounts] = useState<Record<number, number>>({ 3: 1 });
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [pixPayment, setPixPayment] = useState<{ encodedImage: string; payload: string; expirationDate?: string } | null>(null);
  const [creditPaymentComplete, setCreditPaymentComplete] = useState(false);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [checkoutError, setCheckoutError] = useState('');
  const [billingDocument, setBillingDocument] = useState('');

  useEffect(() => {
    refreshSubscription();
  }, []); // Remove refreshSubscription from dependencies to avoid infinite loop

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const daysLeft = (endDateStr: string | null) => {
    if (!endDateStr) return 0;
    const endDate = parseISO(endDateStr);
    return Math.max(0, differenceInDays(endDate, new Date()));
  };

  const formatCurrency = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

  const openCheckout = (planId: number, storeCount = 1) => {
    const plan = getPlanCatalogItem(planId);
    if (!plan) return;
    const additionalStores = Math.max(0, storeCount - plan.includedStores);
    setCheckoutPlan({
      planId,
      storeCount,
      planName: plan.name,
      value: plan.monthlyPrice + additionalStores * Number(plan.extraStorePrice || 0),
    });
    setPaymentMethod('PIX');
    setPixPayment(null);
    setCreditPaymentComplete(false);
    setCheckoutError('');
  };

  const handleSubscribeAsaas = async () => {
    if (!checkoutPlan) return;
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidCpfCnpj(billingDocument)) {
      setCheckoutError('Informe um CPF com 11 números ou CNPJ com 14 números.');
      return;
    }

    if (paymentMethod === 'CREDIT_CARD') {
      const requiredCardFields = Object.values(cardForm).every((value) => value.trim());
      if (!requiredCardFields) {
        setCheckoutError('Preencha todos os dados do cartão e do titular.');
        return;
      }
    }

    setCheckoutError('');
    setLoadingPlanId(checkoutPlan.planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-asaas-subscription', {
        body: {
          planId: checkoutPlan.planId,
          storeCount: checkoutPlan.storeCount,
          paymentMethod,
          billingDocument: onlyDigits(billingDocument),
          ...(paymentMethod === 'CREDIT_CARD' ? {
            creditCard: {
              holderName: cardForm.holderName,
              number: onlyDigits(cardForm.number),
              expiryMonth: onlyDigits(cardForm.expiryMonth),
              expiryYear: onlyDigits(cardForm.expiryYear),
              ccv: onlyDigits(cardForm.ccv),
            },
            creditCardHolderInfo: {
              name: cardForm.holderName,
              cpfCnpj: onlyDigits(billingDocument),
              postalCode: onlyDigits(cardForm.postalCode),
              addressNumber: cardForm.addressNumber,
              mobilePhone: onlyDigits(cardForm.mobilePhone),
            },
          } : {}),
        }
      });

      if (error) {
        let message = error.message;
        const context = (error as any).context;
        if (context?.json) {
          const body = await context.json().catch(() => null);
          message = body?.message || body?.error || message;
        }
        throw new Error(message);
      }

      if (paymentMethod === 'PIX') {
        if (!data?.pix?.encodedImage || !data?.pix?.payload) {
          throw new Error('O Asaas criou a cobrança, mas ainda não disponibilizou o QR Code. Tente novamente em instantes.');
        }
        setPixPayment(data.pix);
      } else {
        setCreditPaymentComplete(true);
        toast({
          title: "Pagamento enviado",
          description: "O cartão foi processado. A confirmação do Asaas liberará o plano automaticamente.",
        });
        await refreshSubscription();
      }
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      const errorMessage = error?.message || "Nao foi possivel criar a cobrança no Asaas. Tente novamente.";
      setCheckoutError(errorMessage);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const copyPixCode = async () => {
    if (!pixPayment?.payload) return;
    await navigator.clipboard.writeText(pixPayment.payload);
    toast({ title: 'Código PIX copiado' });
  };

  const getPlanDisplay = (plan: PlanCatalogItem) => {
    const accent = plan.accent || 'green';
    const palette = accent === 'orange'
      ? {
          border: 'border-[#FF6400]/40',
          glow: 'shadow-[0_30px_80px_-45px_rgba(255,100,0,0.55)]',
          header: 'from-[#FF6400] to-[#FF8A3D]',
          chip: 'bg-[#FFF1E8] text-[#C14E00]',
          icon: 'text-[#FF6400]',
          check: 'text-[#FF6400]',
          button: 'bg-[#FF6400] hover:bg-[#e55a00]',
          soft: 'bg-[#FFF7F2]'
        }
      : accent === 'purple'
        ? {
            border: 'border-purple-300',
            glow: 'shadow-[0_30px_80px_-45px_rgba(124,58,237,0.55)]',
            header: 'from-purple-600 to-fuchsia-500',
            chip: 'bg-purple-100 text-purple-700',
            icon: 'text-purple-600',
            check: 'text-purple-600',
            button: 'bg-purple-600 hover:bg-purple-700',
            soft: 'bg-purple-50'
          }
        : {
            border: 'border-[#8CC850]/35',
            glow: 'shadow-[0_30px_80px_-45px_rgba(140,200,80,0.55)]',
            header: 'from-[#003223] to-[#166534]',
            chip: 'bg-[#EEF7E4] text-[#4E8A1F]',
            icon: 'text-[#4E8A1F]',
            check: 'text-[#4E8A1F]',
            button: 'bg-[#003223] hover:bg-[#0b4733]',
            soft: 'bg-[#F8FCF3]'
          };

    const Icon = plan.slug === 'multi' ? Store : Crown;

    return {
      name: plan.name,
      description: plan.description,
      audience: plan.audience,
      features: plan.features || [],
      modules: plan.modules || [],
      badge: plan.badge || '',
      featured: Boolean(plan.featured),
      palette,
      Icon
    };
  };

  const renderTrialInfo = () => {
    if (!subscription?.trial_end) return null;
    
    const days = daysLeft(subscription.trial_end);
    return (
      <Card className="mb-8 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.45)]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock size={20} className="text-amber-600" />
              Período de Avaliação
            </CardTitle>
            <Badge variant={days > 0 ? "outline" : "destructive"} className="border-amber-300 text-amber-700">
              {days > 0 ? "Ativo" : "Expirado"}
            </Badge>
          </div>
          <CardDescription>
            Você está no período de avaliação com acesso liberado para explorar a plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex items-center space-x-2 text-muted-foreground">
            {days > 0 ? (
              <>
                <Clock size={16} />
                <span>Restam {days} dias - Expira em {formatDate(subscription.trial_end)}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} className="text-destructive" />
                <span>Seu período de avaliação expirou em {formatDate(subscription.trial_end)}</span>
              </>
            )}
          </div>
        </CardContent>
        {days <= 3 && (
          <CardFooter>
            <Button 
              onClick={() => openCheckout(2)}
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={loadingPlanId !== null}
            >
              <Crown size={16} className="mr-2" />
              Fazer Upgrade Agora
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  };

  const renderCurrentPlan = () => {
    if (!subscription?.plan_id) return null;
    
    const currentPlan = getPlanCatalogItem(subscription.plan_id);
    if (!currentPlan) return null;
    const display = getPlanDisplay(currentPlan);
    const storeCount = Math.max(1, Number((subscription as any)?.store_count || currentPlan.includedStores || 1));
    const extraStores = currentPlan.slug === 'multi' ? Math.max(0, storeCount - currentPlan.includedStores) : 0;
    const monthlyTotal = currentPlan.monthlyPrice + extraStores * Number(currentPlan.extraStorePrice || 0);

    return (
      <Card className={`mb-8 overflow-hidden border-2 ${display.palette.border} ${display.palette.glow}`}>
        <CardHeader className={`pb-4 text-white bg-gradient-to-r ${display.palette.header}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <display.Icon size={20} />
              Seu Plano Atual
            </CardTitle>
            <Badge variant="outline" className="border-white/30 bg-white/15 text-white">
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className={`pt-5 ${display.palette.soft}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-bold text-2xl text-slate-900">{display.name}</h3>
              <p className="text-sm text-slate-600">{display.description}</p>
            </div>
            <div className="text-left md:text-right">
              <span className="text-3xl font-bold text-slate-900">
                {formatCurrency(monthlyTotal)}
              </span>
              <p className="text-xs text-slate-500">por mês</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Válido até</p>
              <p className="text-sm text-slate-600">{formatDate(subscription.current_period_end)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Próxima cobrança</p>
              <p className="text-sm text-slate-600">{formatCurrency(monthlyTotal)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Lojas incluídas</p>
              <p className="text-sm text-slate-600">
                {currentPlan.slug === 'multi'
                  ? `${storeCount} loja${storeCount === 1 ? '' : 's'}${extraStores > 0 ? ` (${extraStores} extra)` : ''}`
                  : 'Uma loja'}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {display.features.slice(0, 3).map((feature) => (
              <div key={feature} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">
                {feature}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const isTrialSubscription = String(subscription?.status || '').toLowerCase().includes('trial');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4ea_0%,#fff_45%,#f8fafc_100%)] py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <Badge className="mb-4 bg-[#FFF1E8] text-[#C14E00] hover:bg-[#FFF1E8]">Planos PopSystem</Badge>
          <h1 className="mx-auto max-w-4xl text-3xl font-bold tracking-tight text-[#003223] md:text-5xl">
            Escolha o plano certo para o seu restaurante.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Assine pelo Asaas e libere o PopSystem conforme o plano escolhido.
          </p>
        </div>

        {isTrialSubscription && renderTrialInfo()}

        {subscription?.status === 'active' && renderCurrentPlan()}

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLAN_CATALOG.map((plan) => {
            const currentCatalogPlan = subscription?.plan_id ? getPlanCatalogItem(subscription.plan_id) : null;
            const isCurrentPlan = currentCatalogPlan?.slug === plan.slug && subscription?.status === 'active';
            const display = getPlanDisplay(plan);
            const isProcessing = loadingPlanId === plan.id;
            const isMulti = plan.slug === 'multi';
            const selectedStores = Math.max(1, Number(storeCounts[plan.id] || 1));
            const extraStores = isMulti ? Math.max(0, selectedStores - plan.includedStores) : 0;
            const extraStorePrice = Number(plan.extraStorePrice || 149);
            const monthlyTotal = Number(plan.monthlyPrice || 0) + extraStores * extraStorePrice;

            return (
              <Card
                key={plan.id} 
                className={`relative flex h-full flex-col overflow-hidden border-2 bg-white transition-all duration-300 hover:-translate-y-1 ${display.palette.border} ${display.palette.glow}`}
              >
                {isCurrentPlan && (
                  <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-[#003223] px-4 py-1 text-xs font-bold text-white">
                    Plano Atual
                  </div>
                )}

                {display.featured && !isCurrentPlan && (
                  <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#FF6400] px-4 py-1 text-xs font-bold text-white shadow-md">
                    <Crown size={12} />
                    {display.badge}
                  </div>
                )}
                
                <CardHeader className={`bg-gradient-to-br px-6 pb-6 pt-14 text-white ${display.palette.header}`}>
                  <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                    <display.Icon size={24} />
                    {display.name}
                  </CardTitle>
                  <CardDescription className="text-center text-white/90">
                    {display.description}
                  </CardDescription>
                  <div className="mt-5 text-center">
                    <span className="text-4xl font-bold">
                      {formatCurrency(plan.monthlyPrice)}
                    </span>
                    <span className="text-sm text-white/80">/mês</span>
                    {isMulti && (
                      <p className="mt-2 text-sm font-semibold text-white/90">
                        + {formatCurrency(extraStorePrice)}/mês por loja adicional
                      </p>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-grow px-6 pt-6">
                  <div className={`mb-5 rounded-2xl px-4 py-3 text-sm font-medium ${display.palette.soft} ${display.palette.icon}`}>
                    {display.audience}
                  </div>

                  {isMulti && (
                    <div className="mb-5 rounded-2xl border border-purple-200 bg-purple-50 p-4">
                      <label className="text-sm font-semibold text-purple-900">
                        Quantas lojas vão usar?
                      </label>
                      <div className="mt-3 flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-10 rounded-xl p-0"
                          onClick={() => setStoreCounts((current) => ({
                            ...current,
                            [plan.id]: Math.max(1, selectedStores - 1)
                          }))}
                        >
                          -
                        </Button>
                        <input
                          className="h-11 w-20 rounded-xl border border-purple-200 bg-white text-center text-lg font-bold text-purple-900 outline-none focus:border-purple-500"
                          type="number"
                          min={1}
                          value={selectedStores}
                          onChange={(event) => {
                            const nextValue = Math.max(1, Math.floor(Number(event.target.value) || 1));
                            setStoreCounts((current) => ({ ...current, [plan.id]: nextValue }));
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-10 rounded-xl p-0"
                          onClick={() => setStoreCounts((current) => ({
                            ...current,
                            [plan.id]: selectedStores + 1
                          }))}
                        >
                          +
                        </Button>
                        <div className="ml-auto text-right">
                          <p className="text-xs text-purple-700">Total mensal</p>
                          <p className="text-xl font-bold text-purple-950">{formatCurrency(monthlyTotal)}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-purple-700">
                        Uma loja já está incluída. {extraStores > 0 ? `${extraStores} loja(s) adicional(is) entram na mensalidade.` : 'Você pode usar o Multi com uma loja pelo valor base do plano.'}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-3">
                    {display.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className={`mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ${display.palette.check}`} />
                        <span className="text-sm leading-6 text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="pb-6 pt-4">
                  <Button
                    className={`w-full rounded-2xl text-base font-semibold text-white ${display.palette.button}`}
                    onClick={() => openCheckout(plan.id, selectedStores)}
                    disabled={loadingPlanId !== null || isCurrentPlan}
                    variant={isCurrentPlan ? "outline" : "default"}
                    size="lg"
                  >
                    {isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      <>
                        {isProcessing ? "Processando..." : `Assinar ${display.name}${isMulti ? ` - ${formatCurrency(monthlyTotal)}` : ''}`}
                        <ArrowRight size={16} className="ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {isTrialSubscription && (
          <Card className="border-0 bg-gradient-to-r from-[#FF6400] to-[#ff8d4d] text-white shadow-[0_25px_80px_-40px_rgba(255,100,0,0.7)]">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="mb-2 text-2xl font-bold">Pronto para crescer?</h3>
                <p className="mb-4 text-orange-100">
                  Mantenha todas as funcionalidades ativas escolhendo um plano hoje mesmo.
                </p>
                <Button 
                  onClick={() => openCheckout(2)}
                  variant="secondary" 
                  size="lg"
                  disabled={loadingPlanId !== null}
                >
                  <Crown size={16} className="mr-2" />
                  {loadingPlanId === 2 ? "Processando..." : "Fazer Upgrade Agora"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Dialog open={Boolean(checkoutPlan)} onOpenChange={(open) => {
          if (!open) {
            setCheckoutPlan(null);
            setPixPayment(null);
            setCreditPaymentComplete(false);
            setCheckoutError('');
            setCardForm(emptyCardForm);
          }
        }}>
          <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto p-0">
            <DialogHeader className="border-b px-6 py-4 text-left">
              <DialogTitle>Finalizar assinatura</DialogTitle>
              <DialogDescription>
                {checkoutPlan
                  ? `${checkoutPlan.planName} - ${formatCurrency(checkoutPlan.value)} por mês`
                  : 'Finalize o pagamento para ativar o plano.'}
              </DialogDescription>
            </DialogHeader>

            {creditPaymentComplete ? (
              <div className="space-y-5 px-6 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-7 w-7 text-emerald-700" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">Pagamento enviado com sucesso</p>
                  <p className="text-sm leading-6 text-slate-600">
                    Assim que o Asaas confirmar a transação, o plano será liberado automaticamente.
                  </p>
                </div>
                <Button className="w-full bg-[#003223] hover:bg-[#0b4733]" onClick={() => setCheckoutPlan(null)}>
                  Concluir
                </Button>
              </div>
            ) : pixPayment ? (
              <div className="space-y-5 px-6 py-6 text-center">
                <div>
                  <p className="font-semibold text-slate-900">Escaneie o QR Code para pagar</p>
                  <p className="mt-1 text-sm text-slate-600">A confirmação acontece automaticamente após o pagamento.</p>
                </div>
                <img
                  src={`data:image/png;base64,${pixPayment.encodedImage}`}
                  alt="QR Code PIX da assinatura"
                  className="mx-auto h-56 w-56 rounded-xl border bg-white p-2"
                />
                <div className="rounded-xl border bg-slate-50 p-3 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">PIX copia e cola</p>
                  <p className="break-all text-xs text-slate-700">{pixPayment.payload}</p>
                </div>
                <Button className="w-full bg-[#003223] hover:bg-[#0b4733]" onClick={copyPixCode}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar código PIX
                </Button>
              </div>
            ) : (
              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('PIX'); setCheckoutError(''); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-semibold transition ${paymentMethod === 'PIX' ? 'border-[#003223] bg-emerald-50 text-[#003223]' : 'border-slate-200 text-slate-600'}`}
                  >
                    <QrCode className="h-5 w-5" /> PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('CREDIT_CARD'); setCheckoutError(''); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-semibold transition ${paymentMethod === 'CREDIT_CARD' ? 'border-[#003223] bg-emerald-50 text-[#003223]' : 'border-slate-200 text-slate-600'}`}
                  >
                    <CreditCard className="h-5 w-5" /> Crédito
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#003223]">CPF ou CNPJ</label>
                  <Input value={billingDocument} onChange={(event) => setBillingDocument(event.target.value)} inputMode="numeric" placeholder="Somente números" />
                </div>

                {paymentMethod === 'PIX' ? (
                  <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                    O QR Code será exibido nesta tela. A renovação mensal gera uma nova cobrança PIX e o plano permanece ativo após cada confirmação.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#003223]">Nome impresso no cartão</label>
                      <Input value={cardForm.holderName} onChange={(event) => setCardForm({ ...cardForm, holderName: event.target.value })} autoComplete="cc-name" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#003223]">Número do cartão</label>
                      <Input value={cardForm.number} onChange={(event) => setCardForm({ ...cardForm, number: event.target.value })} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#003223]">Mês</label>
                        <Input value={cardForm.expiryMonth} onChange={(event) => setCardForm({ ...cardForm, expiryMonth: event.target.value })} inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength={2} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#003223]">Ano</label>
                        <Input value={cardForm.expiryYear} onChange={(event) => setCardForm({ ...cardForm, expiryYear: event.target.value })} inputMode="numeric" autoComplete="cc-exp-year" placeholder="AAAA" maxLength={4} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#003223]">CVV</label>
                        <Input value={cardForm.ccv} onChange={(event) => setCardForm({ ...cardForm, ccv: event.target.value })} inputMode="numeric" autoComplete="cc-csc" placeholder="000" maxLength={4} type="password" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#003223]">CEP do titular</label>
                        <Input value={cardForm.postalCode} onChange={(event) => setCardForm({ ...cardForm, postalCode: event.target.value })} inputMode="numeric" autoComplete="postal-code" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#003223]">Número</label>
                        <Input value={cardForm.addressNumber} onChange={(event) => setCardForm({ ...cardForm, addressNumber: event.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#003223]">Celular do titular</label>
                      <Input value={cardForm.mobilePhone} onChange={(event) => setCardForm({ ...cardForm, mobilePhone: event.target.value })} inputMode="tel" autoComplete="tel" />
                    </div>
                    <p className="text-xs leading-5 text-slate-500">Os dados do cartão são enviados por conexão segura diretamente ao Asaas e não são armazenados pelo PopSystem.</p>
                  </div>
                )}

                {checkoutError && (
                  <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{checkoutError}</div>
                )}

                <Button className="w-full bg-[#003223] hover:bg-[#0b4733]" onClick={handleSubscribeAsaas} disabled={loadingPlanId !== null}>
                  {loadingPlanId !== null
                    ? 'Processando...'
                    : paymentMethod === 'PIX'
                      ? 'Gerar QR Code PIX'
                      : `Pagar ${checkoutPlan ? formatCurrency(checkoutPlan.value) : ''}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Subscription;
