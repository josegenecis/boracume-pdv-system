import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { SessionCache } from './session-cache';
import { logOAuthTokenRefresh, logOAuthTokenExpired } from './oauth-security-logger';

interface TokenRefreshConfig {
  refreshThreshold: number; // Minutos antes da expiração para refresh
  maxRetries: number;
  retryDelay: number; // Milissegundos
}

class TokenRefreshManager {
  private static instance: TokenRefreshManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private config: TokenRefreshConfig = {
    refreshThreshold: 5, // 5 minutos antes da expiração
    maxRetries: 3,
    retryDelay: 1000 // 1 segundo
  };

  private constructor() {}

  static getInstance(): TokenRefreshManager {
    if (!TokenRefreshManager.instance) {
      TokenRefreshManager.instance = new TokenRefreshManager();
    }
    return TokenRefreshManager.instance;
  }

  /**
   * Inicia o monitoramento automático de refresh de tokens
   */
  startAutoRefresh(session: Session): void {
    this.stopAutoRefresh();
    
    if (!session.expires_at) {
      console.warn('⚠️ Sessão sem tempo de expiração definido');
      return;
    }

    const expiresAt = session.expires_at * 1000; // Converter para milissegundos
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const refreshTime = timeUntilExpiry - (this.config.refreshThreshold * 60 * 1000);

    if (refreshTime <= 0) {
      console.log('🔄 Token próximo da expiração, fazendo refresh imediato');
      this.refreshToken(session);
      return;
    }

    console.log(`⏰ Agendando refresh do token em ${Math.round(refreshTime / 1000 / 60)} minutos`);
    
    this.refreshTimer = setTimeout(() => {
      this.refreshToken(session);
    }, refreshTime);
  }

  /**
   * Para o monitoramento automático
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Força o refresh do token
   */
  async forceRefresh(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return this.refreshToken(session);
    }
    return null;
  }

  /**
   * Verifica se o token precisa ser renovado
   */
  needsRefresh(session: Session): boolean {
    if (!session.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const refreshThreshold = this.config.refreshThreshold * 60 * 1000;
    
    return timeUntilExpiry <= refreshThreshold;
  }

  /**
   * Verifica se o token está expirado
   */
  isExpired(session: Session): boolean {
    if (!session.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    
    return now >= expiresAt;
  }

  /**
   * Executa o refresh do token com retry automático
   */
  private async refreshToken(session: Session, retryCount = 0): Promise<Session | null> {
    if (this.isRefreshing) {
      console.log('🔄 Refresh já em andamento, aguardando...');
      return this.waitForRefresh();
    }

    this.isRefreshing = true;

    try {
      console.log('🔄 Iniciando refresh do token...');
      
      // Log do início do refresh
      await logOAuthTokenRefresh(
        session.user?.app_metadata?.provider || 'unknown',
        session.user?.id || '',
        session.user?.email || '',
        'started',
        {
          expiresAt: session.expires_at,
          retryCount
        }
      );

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('❌ Erro no refresh do token:', error);
        
        // Log da falha no refresh
        await logOAuthTokenRefresh(
          session.user?.app_metadata?.provider || 'unknown',
          session.user?.id || '',
          session.user?.email || '',
          'failed',
          {
            error: error.message,
            retryCount
          }
        );

        // Tentar novamente se não excedeu o limite
        if (retryCount < this.config.maxRetries) {
          console.log(`🔄 Tentativa ${retryCount + 1}/${this.config.maxRetries} em ${this.config.retryDelay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          return this.refreshToken(session, retryCount + 1);
        }

        // Se esgotou as tentativas, marcar token como expirado
        await logOAuthTokenExpired(
          session.user?.app_metadata?.provider || 'unknown',
          session.user?.id || '',
          {
            reason: 'refresh_failed',
            attempts: retryCount + 1
          }
        );

        throw error;
      }

      if (data.session) {
        console.log('✅ Token renovado com sucesso');
        
        // Atualizar cache
        SessionCache.set(data.session);
        
        // Log do sucesso do refresh
        await logOAuthTokenRefresh(
          data.session.user?.app_metadata?.provider || 'unknown',
          data.session.user?.id || '',
          data.session.user?.email || '',
          'success',
          {
            newExpiresAt: data.session.expires_at,
            retryCount
          }
        );

        // Agendar próximo refresh
        this.startAutoRefresh(data.session);
        
        return data.session;
      }

      throw new Error('Sessão não retornada após refresh');

    } catch (error: any) {
      console.error('❌ Falha crítica no refresh do token:', error);
      
      // Log da falha crítica
      await logOAuthTokenExpired(
        session.user?.app_metadata?.provider || 'unknown',
        session.user?.id || '',
        {
          reason: 'refresh_critical_failure',
          error: error.message,
          attempts: retryCount + 1
        }
      );

      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Aguarda o refresh em andamento
   */
  private async waitForRefresh(): Promise<Session | null> {
    return new Promise((resolve) => {
      const checkRefresh = () => {
        if (!this.isRefreshing) {
          const { data: { session } } = supabase.auth.getSession();
          resolve(session);
        } else {
          setTimeout(checkRefresh, 100);
        }
      };
      checkRefresh();
    });
  }

  /**
   * Configura os parâmetros do refresh
   */
  configure(config: Partial<TokenRefreshConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtém o status atual do refresh
   */
  getStatus(): {
    isRefreshing: boolean;
    hasTimer: boolean;
    config: TokenRefreshConfig;
  } {
    return {
      isRefreshing: this.isRefreshing,
      hasTimer: this.refreshTimer !== null,
      config: { ...this.config }
    };
  }
}

// Instância singleton
export const tokenRefreshManager = TokenRefreshManager.getInstance();

// Funções de conveniência
export const startTokenAutoRefresh = (session: Session) => {
  tokenRefreshManager.startAutoRefresh(session);
};

export const stopTokenAutoRefresh = () => {
  tokenRefreshManager.stopAutoRefresh();
};

export const forceTokenRefresh = () => {
  return tokenRefreshManager.forceRefresh();
};

export const needsTokenRefresh = (session: Session) => {
  return tokenRefreshManager.needsRefresh(session);
};

export const isTokenExpired = (session: Session) => {
  return tokenRefreshManager.isExpired(session);
};

export const configureTokenRefresh = (config: Partial<TokenRefreshConfig>) => {
  tokenRefreshManager.configure(config);
};

export const getTokenRefreshStatus = () => {
  return tokenRefreshManager.getStatus();
};

// Hook para verificação automática de tokens
export const checkAndRefreshToken = async (): Promise<Session | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    // Verificar se está expirado
    if (tokenRefreshManager.isExpired(session)) {
      console.log('🔄 Token expirado, fazendo refresh...');
      return await tokenRefreshManager.forceRefresh();
    }

    // Verificar se precisa de refresh
    if (tokenRefreshManager.needsRefresh(session)) {
      console.log('🔄 Token próximo da expiração, fazendo refresh...');
      return await tokenRefreshManager.forceRefresh();
    }

    return session;
  } catch (error) {
    console.error('❌ Erro na verificação de token:', error);
    return null;
  }
};