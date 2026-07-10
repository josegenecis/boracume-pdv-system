
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Clock, AlertTriangle, Crown, ArrowRight, Store, ExternalLink } from 'lucide-react';
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

const Subscription = () => {
  const { subscription, refreshSubscription, user } = useAuth();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [storeCounts, setStoreCounts] = useState<Record<number, number>>({ 3: 1 });
  const [paymentFrameUrl, setPaymentFrameUrl] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<{ planName: string; value: number } | null>(null);
  const [billingDocument, setBillingDocument] = useState('');
  const [billingDocumentError, setBillingDocumentError] = useState('');
  const [pendingBillingPlan, setPendingBillingPlan] = useState<{ planId: number; storeCount: number } | null>(null);

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

  const handleSubscribeAsaas = async (planId: number, storeCount = 1, documentOverride?: string) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-asaas-subscription', {
        body: {
          planId,
          storeCount,
          billingDocument: documentOverride ? onlyDigits(documentOverride) : undefined,
        }
      });

      if (error) {
        let message = error.message;
        let needsBillingDocument = false;
        const context = (error as any).context;
        if (context?.json) {
          const body = await context.json().catch(() => null);
          message = body?.message || body?.error || message;
          needsBillingDocument = Boolean(body?.needsBillingDocument);
        }

        if (needsBillingDocument || /cpf|cnpj/i.test(message)) {
          setPendingBillingPlan({ planId, storeCount });
          setBillingDocument(documentOverride || billingDocument);
          setBillingDocumentError('Informe o CPF ou CNPJ do cliente para gerar a cobrança.');
          return;
        }
        throw new Error(message);
      }

      const paymentUrl = data?.paymentUrl || data?.invoiceUrl || data?.url;
      if (paymentUrl) {
        const plan = getPlanCatalogItem(planId);
        setPaymentSummary({
          planName: plan?.name || 'Plano PopSystem',
          value: Number(data?.value || plan?.monthlyPrice || 0)
        });
        setPaymentFrameUrl(paymentUrl);
      } else {
        toast({
          title: "Assinatura criada",
          description: "A cobrança foi registrada no Asaas. Assim que o pagamento for confirmado, o plano será liberado.",
        });
        await refreshSubscription();
      }
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      const errorMessage = error?.message || "Nao foi possivel criar a cobrança no Asaas. Tente novamente.";
      toast({
        title: "Erro ao criar cobrança",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleBillingDocumentSubmit = () => {
    if (!pendingBillingPlan) return;

    if (!isValidCpfCnpj(billingDocument)) {
      setBillingDocumentError('Digite um CPF com 11 números ou CNPJ com 14 números.');
      return;
    }

    const plan = pendingBillingPlan;
    setBillingDocumentError('');
    setPendingBillingPlan(null);
    handleSubscribeAsaas(plan.planId, plan.storeCount, billingDocument);
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
              onClick={() => handleSubscribeAsaas(2)} 
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
                    onClick={() => handleSubscribeAsaas(plan.id, selectedStores)}
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
                  onClick={() => handleSubscribeAsaas(2)} 
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
        <Dialog open={Boolean(pendingBillingPlan)} onOpenChange={(open) => {
          if (!open) {
            setPendingBillingPlan(null);
            setBillingDocumentError('');
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Informe CPF ou CNPJ</DialogTitle>
              <DialogDescription>
                O Asaas precisa desse dado para criar a cobrança do plano.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#003223]">
                  CPF ou CNPJ do cliente
                </label>
                <Input
                  value={billingDocument}
                  onChange={(event) => {
                    setBillingDocument(event.target.value);
                    setBillingDocumentError('');
                  }}
                  placeholder="Digite somente números"
                  inputMode="numeric"
                  autoFocus
                />
                {billingDocumentError && (
                  <p className="mt-2 text-sm font-medium text-red-600">{billingDocumentError}</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPendingBillingPlan(null);
                    setBillingDocumentError('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-[#003223] hover:bg-[#0b4733]"
                  onClick={handleBillingDocumentSubmit}
                  disabled={loadingPlanId !== null}
                >
                  Criar cobrança
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(paymentFrameUrl)} onOpenChange={(open) => {
          if (!open) {
            setPaymentFrameUrl(null);
            setPaymentSummary(null);
          }
        }}>
          <DialogContent className="max-w-5xl overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4 text-left">
              <DialogTitle>Pagamento pelo Asaas</DialogTitle>
              <DialogDescription>
                {paymentSummary
                  ? `${paymentSummary.planName} - ${formatCurrency(paymentSummary.value)}`
                  : 'Finalize o pagamento para ativar o plano.'}
              </DialogDescription>
            </DialogHeader>
            {paymentFrameUrl && (
              <div className="bg-slate-50">
                <iframe
                  title="Pagamento Asaas"
                  src={paymentFrameUrl}
                  className="h-[72vh] w-full border-0 bg-white"
                />
                <div className="flex items-center justify-between gap-3 border-t bg-white px-6 py-3 text-sm text-slate-600">
                  <span>Quando o Asaas confirmar o pagamento, o PopSystem libera o plano automaticamente.</span>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href={paymentFrameUrl} target="_blank" rel="noreferrer">
                      Abrir cobrança
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Subscription;
