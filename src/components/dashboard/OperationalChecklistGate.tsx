import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import OperationalChecklistDialog from '@/components/dashboard/OperationalChecklistDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const todayKey = () => new Date().toISOString().slice(0, 10);

const publicRoutePrefixes = [
  '/',
  '/login',
  '/signup',
  '/reset-password',
  '/landing',
  '/auth/callback',
  '/menu',
  '/checklist',
  '/menu-digital',
  '/totem',
  '/track',
  '/mp',
  '/admin-popsystem',
  '/waiter-login',
  '/waiter-dashboard',
  '/waiter-session',
  '/funcionario-login',
  '/funcionario-ponto',
];

const shouldSkipChecklist = (pathname: string) => {
  if (pathname === '/') return true;
  return publicRoutePrefixes.some((prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
};

export const OperationalChecklistGate: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const checkingRef = useRef(false);

  const checkChecklist = useCallback(async () => {
    if (!user?.id || shouldSkipChecklist(location.pathname) || checkingRef.current) {
      setOpen(false);
      return;
    }

    checkingRef.current = true;
    try {
      const [{ data: settings, error: settingsError }, { data: run, error: runError }] = await Promise.all([
        (supabase as any)
          .from('restaurant_checklist_settings')
          .select('enabled, require_daily')
          .eq('user_id', user.id)
          .maybeSingle(),
        (supabase as any)
          .from('restaurant_checklist_runs')
          .select('status')
          .eq('user_id', user.id)
          .eq('business_date', todayKey())
          .maybeSingle(),
      ]);

      if (settingsError || runError) {
        console.warn('Falha ao verificar checklist obrigatório:', settingsError || runError);
        setOpen(false);
        return;
      }

      const required = Boolean(settings?.enabled && settings?.require_daily !== false);
      setOpen(required && run?.status !== 'completed');
    } catch (error) {
      console.warn('Falha ao verificar checklist obrigatório:', error);
      setOpen(false);
    } finally {
      checkingRef.current = false;
    }
  }, [location.pathname, user?.id]);

  useEffect(() => {
    void checkChecklist();
  }, [checkChecklist]);

  useEffect(() => {
    const handleFocus = () => void checkChecklist();
    window.addEventListener('focus', handleFocus);
    const timer = window.setInterval(() => void checkChecklist(), 60000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(timer);
    };
  }, [checkChecklist]);

  if (!user?.id || shouldSkipChecklist(location.pathname)) return null;

  return (
    <OperationalChecklistDialog
      open={open}
      onOpenChange={setOpen}
      onUpdated={checkChecklist}
      locked
    />
  );
};

export default OperationalChecklistGate;
