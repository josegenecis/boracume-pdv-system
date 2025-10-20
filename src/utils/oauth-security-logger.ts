import { logSecurityEvent } from './securityLogger';

/**
 * Interface para eventos de segurança OAuth específicos
 */
export interface OAuthSecurityEvent {
  type: 'oauth_login_attempt' | 'oauth_login_success' | 'oauth_login_failure' | 
        'oauth_callback_received' | 'oauth_callback_error' | 'oauth_token_refresh' |
        'oauth_token_expired' | 'oauth_session_created' | 'oauth_session_destroyed' |
        'oauth_user_sync' | 'oauth_validation_failed' | 'oauth_suspicious_activity';
  userId?: string;
  email?: string;
  provider: 'google';
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userAgent: string;
  ipAddress?: string;
}

/**
 * Logger específico para eventos OAuth
 */
export class OAuthSecurityLogger {
  private static instance: OAuthSecurityLogger;
  private eventQueue: OAuthSecurityEvent[] = [];
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): OAuthSecurityLogger {
    if (!OAuthSecurityLogger.instance) {
      OAuthSecurityLogger.instance = new OAuthSecurityLogger();
    }
    return OAuthSecurityLogger.instance;
  }

  /**
   * Log de tentativa de login OAuth
   */
  async logLoginAttempt(provider: 'google', details: Record<string, any> = {}): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_login_attempt',
      provider,
      details: {
        redirectUrl: window.location.origin + '/auth/callback',
        timestamp: new Date().toISOString(),
        ...details
      },
      severity: 'low',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de login OAuth bem-sucedido
   */
  async logLoginSuccess(
    provider: 'google', 
    userId: string, 
    email: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_login_success',
      userId,
      email,
      provider,
      details: {
        loginTime: new Date().toISOString(),
        sessionCreated: true,
        ...details
      },
      severity: 'low',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de falha no login OAuth
   */
  async logLoginFailure(
    provider: 'google', 
    error: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_login_failure',
      provider,
      details: {
        error,
        errorTime: new Date().toISOString(),
        ...details
      },
      severity: 'medium',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de callback OAuth recebido
   */
  async logCallbackReceived(
    provider: 'google', 
    success: boolean, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_callback_received',
      provider,
      details: {
        success,
        callbackTime: new Date().toISOString(),
        url: window.location.href,
        ...details
      },
      severity: success ? 'low' : 'medium',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de erro no callback OAuth
   */
  async logCallbackError(
    provider: 'google', 
    error: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_callback_error',
      provider,
      details: {
        error,
        errorTime: new Date().toISOString(),
        url: window.location.href,
        ...details
      },
      severity: 'high',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de refresh de token
   */
  async logTokenRefresh(
    provider: 'google', 
    userId: string, 
    success: boolean, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_token_refresh',
      userId,
      provider,
      details: {
        success,
        refreshTime: new Date().toISOString(),
        ...details
      },
      severity: success ? 'low' : 'medium',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de token expirado
   */
  async logTokenExpired(
    provider: 'google', 
    userId: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_token_expired',
      userId,
      provider,
      details: {
        expiredTime: new Date().toISOString(),
        ...details
      },
      severity: 'medium',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de criação de sessão
   */
  async logSessionCreated(
    provider: 'google', 
    userId: string, 
    email: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_session_created',
      userId,
      email,
      provider,
      details: {
        sessionTime: new Date().toISOString(),
        ...details
      },
      severity: 'low',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de destruição de sessão
   */
  async logSessionDestroyed(
    provider: 'google', 
    userId?: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_session_destroyed',
      userId,
      provider,
      details: {
        destroyTime: new Date().toISOString(),
        ...details
      },
      severity: 'low',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de sincronização de usuário
   */
  async logUserSync(
    provider: 'google', 
    userId: string, 
    email: string, 
    success: boolean, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_user_sync',
      userId,
      email,
      provider,
      details: {
        success,
        syncTime: new Date().toISOString(),
        ...details
      },
      severity: success ? 'low' : 'medium',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de falha na validação
   */
  async logValidationFailed(
    provider: 'google', 
    validationType: string, 
    errors: string[], 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_validation_failed',
      provider,
      details: {
        validationType,
        errors,
        validationTime: new Date().toISOString(),
        ...details
      },
      severity: 'high',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Log de atividade suspeita
   */
  async logSuspiciousActivity(
    provider: 'google', 
    activity: string, 
    details: Record<string, any> = {}
  ): Promise<void> {
    const event: OAuthSecurityEvent = {
      type: 'oauth_suspicious_activity',
      provider,
      details: {
        activity,
        detectionTime: new Date().toISOString(),
        ...details
      },
      severity: 'critical',
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    await this.logEvent(event);
  }

  /**
   * Processa e envia evento para o sistema de logs
   */
  private async logEvent(event: OAuthSecurityEvent): Promise<void> {
    try {
      // Adicionar à fila
      this.eventQueue.push(event);

      // Processar fila se não estiver processando
      if (!this.isProcessing) {
        await this.processQueue();
      }

      // Log no console para desenvolvimento
      console.log(`🔐 OAuth Security Event [${event.type}]:`, {
        severity: event.severity,
        provider: event.provider,
        userId: event.userId,
        email: event.email,
        details: event.details
      });

    } catch (error) {
      console.error('❌ Erro ao registrar evento de segurança OAuth:', error);
    }
  }

  /**
   * Processa fila de eventos
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.sendToSecurityLog(event);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar fila de eventos OAuth:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Envia evento para o sistema de logs de segurança
   */
  private async sendToSecurityLog(event: OAuthSecurityEvent): Promise<void> {
    try {
      const description = this.formatEventDescription(event);
      
      await logSecurityEvent(
        event.type,
        description,
        event.severity
      );

    } catch (error) {
      console.error('❌ Erro ao enviar evento para log de segurança:', error);
    }
  }

  /**
   * Formata descrição do evento
   */
  private formatEventDescription(event: OAuthSecurityEvent): string {
    const parts = [
      `OAuth ${event.provider} - ${event.type.replace('oauth_', '').replace('_', ' ')}`
    ];

    if (event.email) {
      parts.push(`User: ${event.email}`);
    }

    if (event.userId) {
      parts.push(`ID: ${event.userId}`);
    }

    // Adicionar detalhes importantes
    if (event.details.error) {
      parts.push(`Error: ${event.details.error}`);
    }

    if (event.details.success !== undefined) {
      parts.push(`Success: ${event.details.success}`);
    }

    return parts.join(' | ');
  }

  /**
   * Obtém estatísticas dos eventos
   */
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    // Aqui você poderia implementar lógica para buscar estatísticas
    // do banco de dados ou cache local
    
    return stats;
  }

  /**
   * Limpa fila de eventos (para testes)
   */
  clearQueue(): void {
    this.eventQueue = [];
  }
}

// Instância singleton
export const oauthSecurityLogger = OAuthSecurityLogger.getInstance();

// Funções de conveniência para uso direto
export const logOAuthLoginAttempt = (provider: 'google', details?: Record<string, any>) => 
  oauthSecurityLogger.logLoginAttempt(provider, details);

export const logOAuthLoginSuccess = (provider: 'google', userId: string, email: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logLoginSuccess(provider, userId, email, details);

export const logOAuthLoginFailure = (provider: 'google', error: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logLoginFailure(provider, error, details);

export const logOAuthCallbackReceived = (provider: 'google', success: boolean, details?: Record<string, any>) => 
  oauthSecurityLogger.logCallbackReceived(provider, success, details);

export const logOAuthCallbackError = (provider: 'google', error: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logCallbackError(provider, error, details);

export const logOAuthTokenRefresh = (provider: 'google', userId: string, success: boolean, details?: Record<string, any>) => 
  oauthSecurityLogger.logTokenRefresh(provider, userId, success, details);

export const logOAuthTokenExpired = (provider: 'google', userId: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logTokenExpired(provider, userId, details);

export const logOAuthSessionCreated = (provider: 'google', userId: string, email: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logSessionCreated(provider, userId, email, details);

export const logOAuthSessionDestroyed = (provider: 'google', userId?: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logSessionDestroyed(provider, userId, details);

export const logOAuthUserSync = (provider: 'google', userId: string, email: string, success: boolean, details?: Record<string, any>) => 
  oauthSecurityLogger.logUserSync(provider, userId, email, success, details);

export const logOAuthValidationFailed = (provider: 'google', validationType: string, errors: string[], details?: Record<string, any>) => 
  oauthSecurityLogger.logValidationFailed(provider, validationType, errors, details);

export const logOAuthSuspiciousActivity = (provider: 'google', activity: string, details?: Record<string, any>) => 
  oauthSecurityLogger.logSuspiciousActivity(provider, activity, details);