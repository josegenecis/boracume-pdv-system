
import { supabase } from '@/integrations/supabase/client';

export type SecurityEventType = 
  | 'login' 
  | 'logout' 
  | 'signup'
  | 'failed_login' 
  | 'password_change' 
  | 'profile_update' 
  | 'sensitive_data_access' 
  | 'permission_denied'
  | 'data_export'
  | 'fiscal_access';

export type SecuritySeverity = 'low' | 'medium' | 'high';

export const logSecurityEvent = async (
  eventType: SecurityEventType,
  description: string,
  severity: SecuritySeverity = 'low'
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log security event: No authenticated user');
      return;
    }

    // Direct insert since RPC might not be available
    const { error } = await supabase
      .from('security_logs')
      .insert({
        user_id: user.id,
        event_type: eventType,
        description,
        severity
      });

    if (error) {
      console.error('Failed to log security event:', error);
    }
  } catch (error) {
    console.error('Security logging error:', error);
  }
};

// Função específica para signup que evita o problema de tipo
export const logSignupEvent = async (email: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log signup event: No authenticated user');
      return;
    }

    // Direct insert bypassing type issues
    const { error } = await supabase
      .from('security_logs')
      .insert({
        user_id: user.id,
        event_type: 'signup',
        description: `New user registered: ${email}`,
        severity: 'low'
      });

    if (error) {
      console.error('Failed to log signup event:', error);
    }
  } catch (error) {
    console.error('Signup logging error:', error);
  }
};

export const logSensitiveAccess = (resourceType: string, action: string) => {
  logSecurityEvent(
    'sensitive_data_access',
    `Accessed ${resourceType} - ${action}`,
    'medium'
  );
};

export const logPermissionDenied = (resource: string, attemptedAction: string) => {
  logSecurityEvent(
    'permission_denied',
    `Permission denied for ${resource} - attempted: ${attemptedAction}`,
    'high'
  );
};
