
import { supabase } from '@/integrations/supabase/client';

export type SecurityEventType = 
  | 'login' 
  | 'logout' 
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

    const { error } = await supabase.rpc('log_security_event', {
      p_user_id: user.id,
      p_event_type: eventType,
      p_description: description,
      p_severity: severity
    });

    if (error) {
      console.error('Failed to log security event:', error);
    }
  } catch (error) {
    console.error('Security logging error:', error);
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
