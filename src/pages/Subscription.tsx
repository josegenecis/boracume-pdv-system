
import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, AlertTriangle, Crown, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Subscription = () => {
  const { subscription, refreshSubscription } = useAuth();
  const { plans, handleSubscribe, isLoading } = useSubscription();
  const { toast } = useToast();

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const daysLeft = (endDateStr: string | null) => {
    if (!endDateStr) return 0;
    const endDate = parseISO(endDateStr);
    return Math.max(0, differenceInDays(endDate, new Date()));
  };

  const handlePlanSelection = async (planId: number) => {
    try {
      await handleSubscribe(planId);
      toast({
        title: "Plano selecionado com sucesso!",
        description: "Seu plano foi atualizado.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao selecionar plano",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpgrade = () => {
    // Simular redirecionamento para checkout
    toast({
      title: "Redirecionando para checkout",
      description: "Você será direcionado para finalizar a assinatura.",
    });
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
            <Button onClick={handleUpgrade} className="w-full bg-amber-600 hover:bg-amber-700">
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
      case 'Basic':
        return [
          'Cardápio digital',
          'PDV básico',
          'Recebimento de pedidos',
          'Gestão de produtos',
          'Relatórios básicos',
          'Suporte por email'
        ];
      case 'Elite':
        return [
          'Tudo do plano Basic',
          'Gestão de entregadores',
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
    return planName === 'Elite' ? <Crown size={20} /> : <Zap size={20} />;
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
            const isElite = plan.name === 'Elite';
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isCurrentPlan ? "border-2 border-boracume-green" : ""} ${isElite ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : ""}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-boracume-green text-white px-4 py-1 rounded-full text-xs font-bold">
                    Plano Atual
                  </div>
                )}
                {isElite && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Crown size={12} />
                    Mais Popular
                  </div>
                )}
                
                <CardHeader className={isElite ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg" : ""}>
                  <CardTitle className="flex items-center gap-2">
                    {getPlanIcon(plan.name)}
                    {plan.name}
                  </CardTitle>
                  <CardDescription className={isElite ? "text-amber-100" : ""}>
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4">
                    <span className={`text-4xl font-bold ${isElite ? "text-white" : "text-boracume-orange"}`}>
                      R$ {plan.price.toFixed(2)}
                    </span>
                    <span className={`text-sm ${isElite ? "text-amber-100" : "text-muted-foreground"}`}>
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
                    className={`w-full ${isElite ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}`}
                    onClick={() => handlePlanSelection(plan.id)}
                    disabled={isLoading || isCurrentPlan}
                    variant={isElite && !isCurrentPlan ? "default" : isCurrentPlan ? "outline" : "outline"}
                  >
                    {isCurrentPlan ? (
                      "Plano Atual"
                    ) : (
                      <>
                        {isElite && <Crown size={16} className="mr-2" />}
                        Escolher {plan.name}
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
                <Button onClick={handleUpgrade} variant="secondary" size="lg">
                  <Crown size={16} className="mr-2" />
                  Fazer Upgrade Agora
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
