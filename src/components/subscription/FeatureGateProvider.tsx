import React, { createContext, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Crown, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  FeatureKey,
  getFeatureDefinition,
  getRequiredPlan,
  hasFeatureAccess,
} from '@/lib/featureAccess';

type FeatureGateContextValue = {
  canAccessFeature: (feature: FeatureKey) => boolean;
  openFeatureDialog: (feature: FeatureKey) => void;
};

const FeatureGateContext = createContext<FeatureGateContextValue | undefined>(undefined);

export const FeatureGateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { subscription, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const activeDefinition = feature ? getFeatureDefinition(feature) : null;
  const requiredPlan = feature ? getRequiredPlan(feature) : null;

  const value = useMemo<FeatureGateContextValue>(() => ({
    canAccessFeature: (nextFeature) => hasFeatureAccess(nextFeature, subscription),
    openFeatureDialog: (nextFeature) => setFeature(nextFeature),
  }), [subscription]);

  const goToPlan = async () => {
    if (!requiredPlan) return;
    if (!user) {
      setFeature(null);
      navigate(`/subscription?plan=${requiredPlan.id}`);
      return;
    }

    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-subscription', {
        body: { planId: requiredPlan.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        setFeature(null);
      } else {
        navigate(`/subscription?plan=${requiredPlan.id}`);
        setFeature(null);
      }
    } catch (error) {
      console.error('Erro ao abrir checkout do plano:', error);
      toast({
        title: 'Não foi possível abrir o checkout',
        description: 'Abrimos a tela de planos para você tentar novamente.',
        variant: 'destructive',
      });
      navigate(`/subscription?plan=${requiredPlan.id}`);
      setFeature(null);
    } finally {
      setSubscribing(false);
    }
  };

  const isComingSoon = Boolean(activeDefinition?.comingSoon);

  return (
    <FeatureGateContext.Provider value={value}>
      {children}

      <Dialog open={Boolean(feature)} onOpenChange={(open) => !open && setFeature(null)}>
        <DialogContent className="overflow-hidden border-0 p-0 shadow-[0_34px_90px_-35px_rgba(0,50,35,0.5)] sm:max-w-[520px]">
          <div className="bg-gradient-to-br from-[#003223] via-[#0B5137] to-[#FF6400] px-6 py-6 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                {isComingSoon ? <Clock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
              </div>
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
                {isComingSoon ? 'Em breve' : `Plano ${requiredPlan?.shortName || requiredPlan?.name}`}
              </Badge>
            </div>
            <DialogHeader className="mt-5 text-left">
              <DialogTitle className="text-2xl font-bold leading-tight text-white">
                {isComingSoon ? `${activeDefinition?.name} está chegando` : `${activeDefinition?.name} é do plano ${requiredPlan?.name}`}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-white/82">
                {isComingSoon
                  ? 'Essa funcionalidade já está no roadmap do BoraCumê, mas ainda não está liberada para uso em produção.'
                  : `Para usar ${activeDefinition?.name}, seu restaurante precisa estar no plano ${requiredPlan?.name} ou superior.`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-[#FF6400]/15 bg-[#FFF8F2] px-4 py-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-[#FF6400]" />
                <div>
                  <div className="text-sm font-semibold text-[#003223]">
                    {activeDefinition?.description}
                  </div>
                  {requiredPlan && (
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      Incluído a partir do plano {requiredPlan.name}, com mensalidade de R$ {requiredPlan.monthlyPrice.toFixed(2)}.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!isComingSoon && requiredPlan && (
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Crown className="h-4 w-4 text-[#FF6400]" />
                  Plano recomendado: {requiredPlan.name}
                </div>
                <div className="text-xs leading-5 text-slate-600">
                  A contratação abre a tela de planos e usa o checkout da Stripe já configurado no sistema.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t bg-slate-50 px-6 py-4 sm:justify-between sm:space-x-0">
            <Button variant="outline" onClick={() => setFeature(null)} className="rounded-xl">
              {isComingSoon ? 'Entendi' : 'Agora não'}
            </Button>
            {!isComingSoon && (
              <Button onClick={goToPlan} disabled={subscribing} className="rounded-xl bg-[#FF6400] text-white hover:bg-[#e55a00]">
                {subscribing ? 'Abrindo checkout...' : 'Contratar plano'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FeatureGateContext.Provider>
  );
};

export const useFeatureGate = () => {
  const context = useContext(FeatureGateContext);
  if (!context) {
    throw new Error('useFeatureGate must be used within FeatureGateProvider');
  }
  return context;
};
