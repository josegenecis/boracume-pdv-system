
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, AlertTriangle, Crown, Zap, Rocket, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { PLAN_CATALOG, getPlanCatalogItem } from '@/data/planCatalog';

const Subscription = () => {
  const { subscription, refreshSubscription, user } = useAuth();
  const { plans, isLoading } = useSubscription();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);

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

  const handleSubscribeStripe = async (planId: number) => {
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
      const { data, error } = await supabase.functions.invoke('create-stripe-subscription', {
        body: { planId }
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

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Checkout da Stripe nao retornou URL.');
      }
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      const errorMessage = error?.message || "Nao foi possivel processar o pagamento. Tente novamente.";
      toast({
        title: "Erro ao processar pagamento",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const getPlanDisplay = (plan: { id: number; name: string; description: string; price: number; features: string[] }) => {
    const catalog = getPlanCatalogItem(plan.id, plan.name);
    const accent = catalog?.accent || 'green';
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

    const Icon = plan.id === 1 ? Rocket : plan.id === 2 ? Crown : Sparkles;

    return {
      name: catalog?.name || plan.name,
      description: catalog?.description || plan.description,
      audience: catalog?.audience || '',
      features: plan.features?.length ? plan.features : (catalog?.features || []),
      modules: catalog?.modules || [],
      badge: catalog?.badge || '',
      featured: Boolean(catalog?.featured),
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
              onClick={() => handleSubscribeStripe(2)} 
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
    
    const currentPlan = plans.find(p => p.id === subscription.plan_id);
    if (!currentPlan) return null;
    const display = getPlanDisplay(currentPlan);

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
                R$ {currentPlan.price.toFixed(2)}
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
              <p className="text-sm text-slate-600">R$ {currentPlan.price.toFixed(2)}</p>
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
        <div className="mb-10 overflow-hidden rounded-[32px] border border-[#FF6400]/10 bg-white shadow-[0_35px_90px_-55px_rgba(0,50,35,0.35)]">
          <div className="px-6 py-8 md:px-10 md:py-10">
            <Badge className="mb-4 bg-[#FFF1E8] text-[#C14E00] hover:bg-[#FFF1E8]">Planos PopSystem</Badge>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight text-[#003223] md:text-5xl">
                Escolha o plano certo para o seu restaurante crescer sem complicação.
              </h1>
              <p className="mt-4 text-base text-slate-600 md:text-lg">
                Mantive a nova identidade visual, mas deixei a página mais direta: três opções objetivas, preços atualizados e uma leitura mais limpa.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {PLAN_CATALOG.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{plan.shortName}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">R$ {plan.monthlyPrice.toFixed(2)}</div>
                  <div className="mt-1 text-sm text-slate-500">{plan.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isTrialSubscription && renderTrialInfo()}

        {subscription?.status === 'active' && renderCurrentPlan()}

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;
            const display = getPlanDisplay(plan);
            const isProcessing = loadingPlanId === plan.id;

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
                      R$ {plan.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-white/80">/mês</span>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-grow px-6 pt-6">
                  <div className={`mb-5 rounded-2xl px-4 py-3 text-sm font-medium ${display.palette.soft} ${display.palette.icon}`}>
                    {display.audience}
                  </div>
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
                    onClick={() => handleSubscribeStripe(plan.id)}
                    disabled={loadingPlanId !== null || isCurrentPlan}
                    variant={isCurrentPlan ? "outline" : "default"}
                    size="lg"
                  >
                    {isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      <>
                        {isProcessing ? "Processando..." : `Assinar ${display.name}`}
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
                  onClick={() => handleSubscribeStripe(2)} 
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
      </div>
    </div>
  );
};

export default Subscription;
