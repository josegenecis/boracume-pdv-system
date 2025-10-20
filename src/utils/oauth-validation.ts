import { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent } from './securityLogger';

/**
 * Interface para resultado de validação
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * Valida dados do usuário OAuth
 */
export const validateOAuthUser = async (user: User): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  try {
    // Validar email
    if (!user.email) {
      result.errors.push('Email não fornecido pelo provedor OAuth');
      result.isValid = false;
      result.severity = 'high';
    } else if (!isValidEmail(user.email)) {
      result.errors.push('Formato de email inválido');
      result.isValid = false;
      result.severity = 'high';
    }

    // Validar confirmação de email
    if (!user.email_confirmed_at) {
      result.warnings.push('Email não confirmado no provedor OAuth');
      result.severity = result.severity === 'high' ? 'high' : 'medium';
    }

    // Validar ID do usuário
    if (!user.id || user.id.length < 10) {
      result.errors.push('ID de usuário inválido');
      result.isValid = false;
      result.severity = 'high';
    }

    // Validar metadados do usuário
    if (!user.user_metadata) {
      result.warnings.push('Metadados do usuário não disponíveis');
    } else {
      // Verificar dados específicos do Google
      if (!user.user_metadata.full_name && !user.user_metadata.name) {
        result.warnings.push('Nome completo não fornecido pelo Google');
      }
      
      if (!user.user_metadata.avatar_url && !user.user_metadata.picture) {
        result.warnings.push('Foto de perfil não disponível');
      }
    }

    // Validar provedor
    if (!user.app_metadata?.provider || user.app_metadata.provider !== 'google') {
      result.errors.push('Provedor OAuth inválido ou não suportado');
      result.isValid = false;
      result.severity = 'high';
    }

    // Validar timestamp de criação
    if (!user.created_at) {
      result.warnings.push('Data de criação não disponível');
    } else {
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      // Se a conta foi criada há mais de 1 hora, pode ser suspeito
      if (diffMinutes > 60) {
        result.warnings.push('Conta OAuth criada há mais de 1 hora');
      }
    }

    // Log de validação
    await logSecurityEvent(
      'oauth_validation',
      `OAuth user validation: ${result.isValid ? 'PASSED' : 'FAILED'} - ${result.errors.length} errors, ${result.warnings.length} warnings`,
      result.severity
    );

  } catch (error: any) {
    result.errors.push(`Erro durante validação: ${error.message}`);
    result.isValid = false;
    result.severity = 'high';
    
    await logSecurityEvent(
      'oauth_validation_error',
      `OAuth validation failed: ${error.message}`,
      'high'
    );
  }

  return result;
};

/**
 * Valida sessão OAuth
 */
export const validateOAuthSession = async (session: Session): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  try {
    // Validar token de acesso
    if (!session.access_token) {
      result.errors.push('Token de acesso não encontrado');
      result.isValid = false;
      result.severity = 'high';
    } else if (session.access_token.length < 50) {
      result.errors.push('Token de acesso parece inválido');
      result.isValid = false;
      result.severity = 'high';
    }

    // Validar refresh token
    if (!session.refresh_token) {
      result.warnings.push('Refresh token não disponível');
      result.severity = 'medium';
    }

    // Validar expiração
    if (!session.expires_at) {
      result.warnings.push('Data de expiração não definida');
    } else {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      
      if (expiresAt <= now) {
        result.errors.push('Sessão já expirou');
        result.isValid = false;
        result.severity = 'high';
      } else {
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);
        
        if (minutesUntilExpiry < 5) {
          result.warnings.push('Sessão expira em menos de 5 minutos');
          result.severity = 'medium';
        }
      }
    }

    // Validar tipo de token
    if (session.token_type !== 'bearer') {
      result.warnings.push(`Tipo de token inesperado: ${session.token_type}`);
    }

    // Validar usuário na sessão
    if (!session.user) {
      result.errors.push('Dados do usuário não encontrados na sessão');
      result.isValid = false;
      result.severity = 'high';
    } else {
      // Validar usuário também
      const userValidation = await validateOAuthUser(session.user);
      result.errors.push(...userValidation.errors);
      result.warnings.push(...userValidation.warnings);
      
      if (!userValidation.isValid) {
        result.isValid = false;
      }
      
      if (userValidation.severity === 'high') {
        result.severity = 'high';
      } else if (userValidation.severity === 'medium' && result.severity === 'low') {
        result.severity = 'medium';
      }
    }

    // Log de validação da sessão
    await logSecurityEvent(
      'oauth_session_validation',
      `OAuth session validation: ${result.isValid ? 'PASSED' : 'FAILED'} - ${result.errors.length} errors, ${result.warnings.length} warnings`,
      result.severity
    );

  } catch (error: any) {
    result.errors.push(`Erro durante validação da sessão: ${error.message}`);
    result.isValid = false;
    result.severity = 'high';
    
    await logSecurityEvent(
      'oauth_session_validation_error',
      `OAuth session validation failed: ${error.message}`,
      'high'
    );
  }

  return result;
};

/**
 * Valida URL de callback OAuth
 */
export const validateOAuthCallback = (url: string): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  try {
    const urlObj = new URL(url);
    
    // Verificar se é HTTPS em produção
    if (urlObj.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      result.errors.push('Callback deve usar HTTPS em produção');
      result.isValid = false;
      result.severity = 'high';
    }

    // Verificar domínio
    if (urlObj.hostname !== window.location.hostname) {
      result.errors.push('Domínio do callback não corresponde ao domínio atual');
      result.isValid = false;
      result.severity = 'high';
    }

    // Verificar path
    if (!urlObj.pathname.includes('/auth/callback')) {
      result.warnings.push('Path do callback não é o padrão esperado');
    }

    // Verificar parâmetros suspeitos
    const params = urlObj.searchParams;
    const suspiciousParams = ['script', 'javascript', 'eval', 'alert'];
    
    for (const [key, value] of params.entries()) {
      if (suspiciousParams.some(suspicious => 
        key.toLowerCase().includes(suspicious) || 
        value.toLowerCase().includes(suspicious)
      )) {
        result.errors.push(`Parâmetro suspeito detectado: ${key}`);
        result.isValid = false;
        result.severity = 'high';
      }
    }

  } catch (error: any) {
    result.errors.push(`URL de callback inválida: ${error.message}`);
    result.isValid = false;
    result.severity = 'high';
  }

  return result;
};

/**
 * Valida dados de perfil para sincronização
 */
export const validateProfileData = (profileData: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  try {
    // Validar campos obrigatórios
    if (!profileData.id) {
      result.errors.push('ID do perfil é obrigatório');
      result.isValid = false;
      result.severity = 'high';
    }

    if (!profileData.email) {
      result.errors.push('Email é obrigatório');
      result.isValid = false;
      result.severity = 'high';
    } else if (!isValidEmail(profileData.email)) {
      result.errors.push('Formato de email inválido');
      result.isValid = false;
      result.severity = 'high';
    }

    // Validar nome do restaurante
    if (!profileData.restaurant_name) {
      result.warnings.push('Nome do restaurante não definido');
    } else if (profileData.restaurant_name.length < 3) {
      result.warnings.push('Nome do restaurante muito curto');
    } else if (profileData.restaurant_name.length > 100) {
      result.errors.push('Nome do restaurante muito longo');
      result.isValid = false;
    }

    // Validar URL do logo
    if (profileData.logo_url && !isValidUrl(profileData.logo_url)) {
      result.warnings.push('URL do logo parece inválida');
    }

    // Validar valores numéricos
    if (profileData.delivery_fee !== undefined && profileData.delivery_fee < 0) {
      result.errors.push('Taxa de entrega não pode ser negativa');
      result.isValid = false;
    }

    if (profileData.minimum_order !== undefined && profileData.minimum_order < 0) {
      result.errors.push('Pedido mínimo não pode ser negativo');
      result.isValid = false;
    }

  } catch (error: any) {
    result.errors.push(`Erro na validação do perfil: ${error.message}`);
    result.isValid = false;
    result.severity = 'high';
  }

  return result;
};

/**
 * Função auxiliar para validar email
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Função auxiliar para validar URL
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Valida estado geral do OAuth
 */
export const validateOAuthState = async (
  user: User | null,
  session: Session | null
): Promise<ValidationResult> => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    severity: 'low'
  };

  try {
    // Verificar consistência entre usuário e sessão
    if (user && session) {
      if (user.id !== session.user?.id) {
        result.errors.push('Inconsistência entre dados do usuário e sessão');
        result.isValid = false;
        result.severity = 'high';
      }
    } else if (user && !session) {
      result.warnings.push('Usuário presente mas sessão ausente');
      result.severity = 'medium';
    } else if (!user && session) {
      result.warnings.push('Sessão presente mas usuário ausente');
      result.severity = 'medium';
    }

    // Validar individualmente se presentes
    if (user) {
      const userValidation = await validateOAuthUser(user);
      result.errors.push(...userValidation.errors);
      result.warnings.push(...userValidation.warnings);
      
      if (!userValidation.isValid) {
        result.isValid = false;
      }
      
      if (userValidation.severity === 'high') {
        result.severity = 'high';
      }
    }

    if (session) {
      const sessionValidation = await validateOAuthSession(session);
      result.errors.push(...sessionValidation.errors);
      result.warnings.push(...sessionValidation.warnings);
      
      if (!sessionValidation.isValid) {
        result.isValid = false;
      }
      
      if (sessionValidation.severity === 'high') {
        result.severity = 'high';
      }
    }

    // Log do estado geral
    await logSecurityEvent(
      'oauth_state_validation',
      `OAuth state validation: ${result.isValid ? 'PASSED' : 'FAILED'} - ${result.errors.length} errors, ${result.warnings.length} warnings`,
      result.severity
    );

  } catch (error: any) {
    result.errors.push(`Erro na validação do estado OAuth: ${error.message}`);
    result.isValid = false;
    result.severity = 'high';
    
    await logSecurityEvent(
      'oauth_state_validation_error',
      `OAuth state validation failed: ${error.message}`,
      'high'
    );
  }

  return result;
};