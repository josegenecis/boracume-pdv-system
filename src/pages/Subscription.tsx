
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, AlertTriangle, Crown, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const Subscription = () => {
  const { subscription, refreshSubscription, user } = useAuth();
  const { plans, isLoading } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-subscription', {
        body: { planId }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast({
        title: "Erro ao processar pagamento",
        description: "Não foi possível processar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTrialInfo = () => {
    if (!subscription?.trial_end) return null;
    
    const days = daysLeft(subscription.trial_end);
    return (
      <Card className="mb-6 border-amber-200 bg-amber-50">
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
            Experimente todas as funcionalidades do BoraCumê por 7 dias
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
              disabled={loading}
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

    return (
      <Card className="mb-6 border-boracume-green bg-green-50">
        <CardHeader className="pb-2 border-b border-green-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown size={20} className="text-green-600" />
              Seu Plano Atual
            </CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-xl text-green-800">{currentPlan.name}</h3>
              <p className="text-sm text-green-600">{currentPlan.description}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-green-700">
                R$ {currentPlan.price.toFixed(2)}
              </span>
              <p className="text-xs text-green-600">por mês</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm font-medium text-green-800">Válido até:</p>
              <p className="text-sm text-green-600">{formatDate(subscription.current_period_end)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Próxima cobrança:</p>
              <p className="text-sm text-green-600">R$ {currentPlan.price.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getPlanFeatures = (planName: string) => {
    switch (planName) {

      case 'Essencial':
        return [
          'Cardápio digital completo',
          'PDV básico',
          'Recebimento de pedidos online',
          'Gestão de produtos (até 100 itens)',
          'Relatórios básicos',
          'Suporte por email',
          '1 usuário',
          'Backup semanal'
        ];
      case 'Profissional':
        return [
          'Tudo do plano Essencial',
          'Produtos ilimitados',
          'Gestão de entregadores',
          'Sistema KDS (Kitchen Display)',
          'Relatórios avançados e analytics',
          'Sistema financeiro completo',
          'Marketing e promoções',
          'Integração com balanças',
          'QR Code personalizado',
          'Gestão de mesas',
          'Sistema de fidelidade',
          'WhatsApp Bot integrado',
          'Suporte prioritário',
          'Backup diário automático',
          'Até 5 usuários',
          'API para integrações',
          'Relatórios fiscais (NFCe)'
        ];

      case 'Basic':
        return [
          'Cardápio digital',
          'PDV básico',
          'Recebimento de pedidos',
          'Gestão de produtos',
          'Relatórios básicos',
          'Suporte por email'
        ];
      case 'Pro':
        return [
          'Tudo do plano Basic',
          'Gestão de entregadores',
          'Sistema KDS (Cozinha)',
          'Relatórios avançados',
          'Sistema financeiro completo',
          'Marketing e promoções',
          'Integração com balanças',
          'QR Code personalizado',
          'Suporte prioritário',
          'Backup automático',
          'Multi-usuários'
        ];
      default:
        return [];
    }
  };

  const getPlanIcon = (planName: string) => {

    return planName === 'Pro' || planName === 'Profissional' ? <Crown size={20} /> : <Zap size={20} />;

  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Assinatura</h1>
          <p className="text-muted-foreground">Escolha o plano ideal para o seu restaurante</p>
        </div>
        
        {/* Trial Info */}
        {subscription?.status === 'trial' && renderTrialInfo()}
        
        {/* Current Plan */}
        {subscription?.status === 'active' && renderCurrentPlan()}
        
        {/* Available Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_id === plan.id;

            const isPro = plan.name === 'Pro' || plan.name === 'Profissional';

            
            return (
              <Card 
                key={plan.id} 

                className={`relative ${isCurrentPlan ? "border-2 border-boracume-green" : ""} ${isPro || plan.name === 'Profissional' ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : ""}`}

              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-boracume-green text-white px-4 py-1 rounded-full text-xs font-bold">
                    Plano Atual
                  </div>
                )}

                {(isPro || plan.name === 'Profissional') && !isCurrentPlan && (

                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Crown size={12} />
                    Mais Popular
                  </div>
                )}
                
                <CardHeader className={isPro ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg" : ""}>
                  <CardTitle className="flex items-center gap-2">
                    {getPlanIcon(plan.name)}
                    {plan.name}
                  </CardTitle>
                  <CardDescription className={isPro ? "text-amber-100" : ""}>
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4">
                    <span className={`text-4xl font-bold ${isPro ? "text-white" : "text-boracume-orange"}`}>
                      R$ {plan.price.toFixed(2)}
                    </span>
                    <span className={`text-sm ${isPro ? "text-amber-100" : "text-muted-foreground"}`}>
                      /mês
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6 space-y-4">
                  <h4 className="font-medium text-lg">Recursos incluídos:</h4>
                  <ul className="space-y-3">
                    {getPlanFeatures(plan.name).map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button
                    className={`w-full ${isPro ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}`}
                    onClick={() => handleSubscribeStripe(plan.id)}
                    disabled={loading || isCurrentPlan}
                    variant={isPro && !isCurrentPlan ? "default" : isCurrentPlan ? "outline" : "outline"}
                  >
                    {isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      <>
                        {isPro && <Crown size={16} className="mr-2" />}
                        {loading ? "Processando..." : `Escolher ${plan.name}`}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Upgrade CTA */}
        {subscription?.status === 'trial' && (
          <Card className="bg-gradient-to-r from-boracume-orange to-amber-500 text-white">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Pronto para crescer?</h3>
                <p className="mb-4 text-orange-100">
                  Mantenha todas as funcionalidades ativas escolhendo um plano hoje mesmo.
                </p>
                <Button 
                  onClick={() => handleSubscribeStripe(2)} 
                  variant="secondary" 
                  size="lg"
                  disabled={loading}
                >
                  <Crown size={16} className="mr-2" />
                  {loading ? "Processando..." : "Fazer Upgrade Agora"}
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
