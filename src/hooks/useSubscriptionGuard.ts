
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

    const status = String(subscription.status || '').toLowerCase();

    if (allowTrial && status.includes('trial')) {
      return true;
    }

    if (requireActive && status === 'active') {
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
    isTrialing: String(subscription?.status || '').toLowerCase().includes('trial'),
    isActive: subscription?.status === 'active',
  };
};
