import { toast } from 'sonner';
import { logSecurityEvent } from './securityLogger';

export interface OAuthError {
  code: string;
  message: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  userMessage: string;
  shouldRetry: boolean;
}

// Mapeamento de códigos de erro OAuth específicos
export const OAUTH_ERROR_CODES: Record<string, OAuthError> = {
  // Erros de autorização
  'access_denied': {
    code: 'access_denied',
    message: 'User denied access',
    description: 'O usuário cancelou a autorização no Google',
    severity: 'low',
    userMessage: 'Autorização cancelada. Tente novamente se desejar fazer login.',
    shouldRetry: true
  },
  
  'invalid_request': {
    code: 'invalid_request',
    message: 'Invalid OAuth request',
    description: 'Parâmetros de requisição OAuth inválidos',
    severity: 'medium',
    userMessage: 'Erro na configuração. Tente novamente.',
    shouldRetry: true
  },
  
  'unauthorized_client': {
    code: 'unauthorized_client',
    message: 'Unauthorized client',
    description: 'Cliente OAuth não autorizado',
    severity: 'high',
    userMessage: 'Erro de configuração do sistema. Contate o suporte.',
    shouldRetry: false
  },
  
  'unsupported_response_type': {
    code: 'unsupported_response_type',
    message: 'Unsupported response type',
    description: 'Tipo de resposta OAuth não suportado',
    severity: 'high',
    userMessage: 'Erro de configuração do sistema. Contate o suporte.',
    shouldRetry: false
  },
  
  'invalid_scope': {
    code: 'invalid_scope',
    message: 'Invalid scope',
    description: 'Escopo OAuth inválido',
    severity: 'medium',
    userMessage: 'Erro de permissões. Tente novamente.',
    shouldRetry: true
  },
  
  'server_error': {
    code: 'server_error',
    message: 'Server error',
    description: 'Erro interno do servidor OAuth',
    severity: 'high',
    userMessage: 'Erro temporário do servidor. Tente novamente em alguns minutos.',
    shouldRetry: true
  },
  
  'temporarily_unavailable': {
    code: 'temporarily_unavailable',
    message: 'Service temporarily unavailable',
    description: 'Serviço OAuth temporariamente indisponível',
    severity: 'medium',
    userMessage: 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.',
    shouldRetry: true
  },
  
  // Erros específicos do Supabase
  'signup_disabled': {
    code: 'signup_disabled',
    message: 'Signup disabled',
    description: 'Cadastro via OAuth desabilitado',
    severity: 'medium',
    userMessage: 'Cadastro via Google não está disponível no momento.',
    shouldRetry: false
  },
  
  'email_not_confirmed': {
    code: 'email_not_confirmed',
    message: 'Email not confirmed',
    description: 'Email não confirmado no provedor OAuth',
    severity: 'medium',
    userMessage: 'Confirme seu email no Google e tente novamente.',
    shouldRetry: true
  },
  
  'invalid_credentials': {
    code: 'invalid_credentials',
    message: 'Invalid credentials',
    description: 'Credenciais OAuth inválidas',
    severity: 'high',
    userMessage: 'Erro de autenticação. Tente fazer login novamente.',
    shouldRetry: true
  },
  
  'too_many_requests': {
    code: 'too_many_requests',
    message: 'Too many requests',
    description: 'Muitas tentativas de login OAuth',
    severity: 'medium',
    userMessage: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    shouldRetry: true
  },
  
  // Erro genérico
  'unknown_error': {
    code: 'unknown_error',
    message: 'Unknown OAuth error',
    description: 'Erro OAuth desconhecido',
    severity: 'medium',
    userMessage: 'Erro inesperado. Tente novamente.',
    shouldRetry: true
  }
};

/**
 * Processa e trata erros específicos do OAuth
 */
export const handleOAuthError = async (error: any, context: string = 'oauth'): Promise<OAuthError> => {
  let oauthError: OAuthError;
  
  // Extrair código de erro da URL ou objeto de erro
  let errorCode = 'unknown_error';
  
  if (typeof error === 'string') {
    errorCode = error;
  } else if (error?.error) {
    errorCode = error.error;
  } else if (error?.code) {
    errorCode = error.code;
  } else if (error?.message) {
    // Tentar extrair código da mensagem
    const codeMatch = error.message.match(/error_code:\s*(\w+)/i);
    if (codeMatch) {
      errorCode = codeMatch[1];
    }
  }
  
  // Buscar erro específico ou usar genérico
  oauthError = OAUTH_ERROR_CODES[errorCode] || OAUTH_ERROR_CODES['unknown_error'];
  
  // Log de segurança
  await logSecurityEvent(
    'oauth_error',
    `OAuth error in ${context}: ${oauthError.code} - ${oauthError.description}`,
    oauthError.severity
  );
  
  // Mostrar toast para o usuário
  if (oauthError.severity === 'high') {
    toast.error(oauthError.userMessage);
  } else if (oauthError.severity === 'medium') {
    toast.warning(oauthError.userMessage);
  } else {
    toast.info(oauthError.userMessage);
  }
  
  console.error(`🚨 OAuth Error [${oauthError.code}]:`, {
    message: oauthError.message,
    description: oauthError.description,
    severity: oauthError.severity,
    shouldRetry: oauthError.shouldRetry,
    context,
    originalError: error
  });
  
  return oauthError;
};

/**
 * Extrai parâmetros de erro da URL
 */
export const extractOAuthErrorFromUrl = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  
  return urlParams.get('error') || hashParams.get('error');
};

/**
 * Valida se um erro deve permitir nova tentativa
 */
export const shouldRetryOAuthError = (errorCode: string): boolean => {
  const error = OAUTH_ERROR_CODES[errorCode];
  return error ? error.shouldRetry : true;
};

/**
 * Gera mensagem de erro amigável para o usuário
 */
export const getOAuthErrorMessage = (errorCode: string): string => {
  const error = OAUTH_ERROR_CODES[errorCode];
  return error ? error.userMessage : 'Erro inesperado durante a autenticação.';
};