
import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, AlertTriangle } from 'lucide-react';
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

  const renderTrialInfo = () => {
    if (!subscription?.trial_end) return null;
    
    const days = daysLeft(subscription.trial_end);
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Período de Avaliação</CardTitle>
            <Badge variant={days > 0 ? "outline" : "destructive"}>
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
        {days === 0 && (
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Selecione um plano abaixo para continuar usando o BoraCumê
            </p>
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
      <Card className="mb-6 border-boracume-green">
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Seu Plano Atual</CardTitle>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-xl">{currentPlan.name}</h3>
              <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-boracume-green">
                R$ {currentPlan.price.toFixed(2)}
              </span>
              <p className="text-xs text-muted-foreground">por mês</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Válido até:</p>
            <p className="text-sm">{formatDate(subscription.current_period_end)}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Assinatura</h1>
        
        {/* Trial Info */}
        {subscription?.status === 'trial' && renderTrialInfo()}
        
        {/* Current Plan */}
        {subscription?.status === 'active' && renderCurrentPlan()}
        
        {/* Available Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={subscription?.plan_id === plan.id ? "border-2 border-boracume-green relative" : ""}
            >
              {subscription?.plan_id === plan.id && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-boracume-green text-white px-3 py-1 rounded-full text-xs font-bold">
                  Plano Atual
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">R$ {plan.price.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <h4 className="font-medium">Recursos incluídos:</h4>
                <ul className="space-y-2">
                  {(plan.features as string[]).map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-boracume-green mr-2" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handlePlanSelection(plan.id)}
                  disabled={isLoading || subscription?.plan_id === plan.id}
                  variant={plan.name === 'Elite' ? 'default' : 'outline'}
                >
                  {subscription?.plan_id === plan.id 
                    ? 'Plano Atual' 
                    : `Escolher ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Subscription;
