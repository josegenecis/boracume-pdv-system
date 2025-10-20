/**
 * Sistema de pré-carregamento de dados do usuário
 * Carrega dados antecipadamente para melhorar a experiência do usuário
 */

import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { ProfileCache, SubscriptionCache } from './session-cache';

interface PreloadedData {
  profile?: any;
  subscription?: any;
  preferences?: any;
  notifications?: any;
}

interface PreloadOptions {
  includeProfile?: boolean;
  includeSubscription?: boolean;
  includePreferences?: boolean;
  includeNotifications?: boolean;
  useCache?: boolean;
}

class UserPreloader {
  private static instance: UserPreloader;
  private preloadQueue: Map<string, Promise<PreloadedData>> = new Map();
  private preloadCache: Map<string, { data: PreloadedData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

  static getInstance(): UserPreloader {
    if (!UserPreloader.instance) {
      UserPreloader.instance = new UserPreloader();
    }
    return UserPreloader.instance;
  }

  /**
   * Pré-carrega dados do usuário de forma assíncrona
   */
  async preloadUserData(
    userId: string, 
    options: PreloadOptions = {}
  ): Promise<PreloadedData> {
    const {
      includeProfile = true,
      includeSubscription = true,
      includePreferences = false,
      includeNotifications = false,
      useCache = true
    } = options;

    const cacheKey = `${userId}-${JSON.stringify(options)}`;

    // Verificar se já existe uma operação em andamento
    if (this.preloadQueue.has(cacheKey)) {
      return this.preloadQueue.get(cacheKey)!;
    }

    // Verificar cache local
    if (useCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Criar nova operação de pré-carregamento
    const preloadPromise = this.performPreload(userId, {
      includeProfile,
      includeSubscription,
      includePreferences,
      includeNotifications
    });

    this.preloadQueue.set(cacheKey, preloadPromise);

    try {
      const result = await preloadPromise;
      
      // Salvar no cache local
      this.setCachedData(cacheKey, result);
      
      return result;
    } finally {
      // Remover da fila
      this.preloadQueue.delete(cacheKey);
    }
  }

  /**
   * Pré-carrega dados baseado no contexto do usuário
   */
  async preloadByContext(user: User, context: 'login' | 'dashboard' | 'profile'): Promise<PreloadedData> {
    const contextOptions: Record<string, PreloadOptions> = {
      login: {
        includeProfile: true,
        includeSubscription: true,
        includePreferences: false,
        includeNotifications: false
      },
      dashboard: {
        includeProfile: true,
        includeSubscription: true,
        includePreferences: true,
        includeNotifications: true
      },
      profile: {
        includeProfile: true,
        includeSubscription: false,
        includePreferences: true,
        includeNotifications: false
      }
    };

    return this.preloadUserData(user.id, contextOptions[context]);
  }

  /**
   * Executa o pré-carregamento real dos dados
   */
  private async performPreload(
    userId: string,
    options: Required<Omit<PreloadOptions, 'useCache'>>
  ): Promise<PreloadedData> {
    const promises: Promise<any>[] = [];
    const result: PreloadedData = {};

    // Pré-carregar perfil
    if (options.includeProfile) {
      promises.push(
        this.preloadProfile(userId).then(profile => {
          result.profile = profile;
        }).catch(error => {
          console.warn('Erro ao pré-carregar perfil:', error);
          result.profile = null;
        })
      );
    }

    // Pré-carregar assinatura
    if (options.includeSubscription) {
      promises.push(
        this.preloadSubscription(userId).then(subscription => {
          result.subscription = subscription;
        }).catch(error => {
          console.warn('Erro ao pré-carregar assinatura:', error);
          result.subscription = null;
        })
      );
    }

    // Pré-carregar preferências
    if (options.includePreferences) {
      promises.push(
        this.preloadPreferences(userId).then(preferences => {
          result.preferences = preferences;
        }).catch(error => {
          console.warn('Erro ao pré-carregar preferências:', error);
          result.preferences = null;
        })
      );
    }

    // Pré-carregar notificações
    if (options.includeNotifications) {
      promises.push(
        this.preloadNotifications(userId).then(notifications => {
          result.notifications = notifications;
        }).catch(error => {
          console.warn('Erro ao pré-carregar notificações:', error);
          result.notifications = null;
        })
      );
    }

    // Aguardar todas as operações
    await Promise.allSettled(promises);

    return result;
  }

  /**
   * Pré-carrega dados do perfil
   */
  private async preloadProfile(userId: string): Promise<any> {
    // Verificar cache primeiro
    const cached = ProfileCache.get();
    if (cached && ProfileCache.isValid()) {
      return cached;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Salvar no cache
    if (data) {
      ProfileCache.set(data);
    }

    return data;
  }

  /**
   * Pré-carrega dados da assinatura
   */
  private async preloadSubscription(userId: string): Promise<any> {
    // Verificar cache primeiro
    const cached = SubscriptionCache.get();
    if (cached && SubscriptionCache.isValid()) {
      return cached;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Salvar no cache
    if (data) {
      SubscriptionCache.set(data);
    }

    return data;
  }

  /**
   * Pré-carrega preferências do usuário
   */
  private async preloadPreferences(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Pré-carrega notificações do usuário
   */
  private async preloadNotifications(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Obtém dados do cache local
   */
  private getCachedData(key: string): PreloadedData | null {
    const cached = this.preloadCache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.preloadCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Salva dados no cache local
   */
  private setCachedData(key: string, data: PreloadedData): void {
    this.preloadCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Limpa o cache de pré-carregamento
   */
  clearCache(): void {
    this.preloadCache.clear();
    this.preloadQueue.clear();
  }

  /**
   * Pré-carrega dados em background para melhorar performance
   */
  async backgroundPreload(userId: string): Promise<void> {
    try {
      // Pré-carregar dados essenciais em background
      this.preloadUserData(userId, {
        includeProfile: true,
        includeSubscription: true,
        includePreferences: true,
        includeNotifications: false,
        useCache: true
      });
    } catch (error) {
      console.warn('Erro no pré-carregamento em background:', error);
    }
  }
}

// Instância singleton
export const userPreloader = UserPreloader.getInstance();

// Funções de conveniência
export const preloadUserData = (userId: string, options?: PreloadOptions) => 
  userPreloader.preloadUserData(userId, options);

export const preloadByContext = (user: User, context: 'login' | 'dashboard' | 'profile') =>
  userPreloader.preloadByContext(user, context);

export const backgroundPreload = (userId: string) =>
  userPreloader.backgroundPreload(userId);

export const clearPreloadCache = () =>
  userPreloader.clearCache();