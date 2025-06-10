
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionGuardOptions {
  redirectTo?: string;
  requireActive?: boolean;
  allowTrial?: boolean;
  feature?: string;
}

export const useSubscriptionGuard = (options: SubscriptionGuardOptions = {}) => {
  const { 
    redirectTo = '/subscription', 
    requireActive = true, 
    allowTrial = true,
    feature = 'esta funcionalidade'
  } = options;
  
  const { subscription, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const hasAccess = () => {
    if (!user) return false;
    if (!subscription) return false;

    if (allowTrial && subscription.status === 'trialing') {
      return true;
    }

    if (requireActive && subscription.status === 'active') {
      return true;
    }

    return false;
  };

  const checkAccess = () => {
    if (!hasAccess()) {
      toast({
        title: 'Acesso restrito',
        description: `Para usar ${feature}, você precisa de uma assinatura ativa.`,
        variant: 'destructive',
      });
      navigate(redirectTo);
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (user && !hasAccess()) {
      checkAccess();
    }
  }, [user, subscription]);

  return {
    hasAccess: hasAccess(),
    checkAccess,
    subscription,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',
  };
};
