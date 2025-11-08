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
    console.log('🔍 [PRELOAD] Iniciando preloadUserData para userId:', userId, 'options:', options);
    
    const {
      includeProfile = true,
      includeSubscription = true,
      includePreferences = false,
      includeNotifications = false,
      useCache = true
    } = options;

    const cacheKey = `${userId}-${JSON.stringify(options)}`;
    console.log('🔍 [PRELOAD] Cache key gerada:', cacheKey);

    // Verificar se já existe uma operação em andamento
    if (this.preloadQueue.has(cacheKey)) {
      console.log('🔍 [PRELOAD] Operação já em andamento, aguardando...');
      return this.preloadQueue.get(cacheKey)!;
    }

    // Verificar cache local
    if (useCache) {
      console.log('🔍 [PRELOAD] Verificando cache local...');
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log('✅ [PRELOAD] Dados encontrados no cache:', cached);
        return cached;
      }
      console.log('🔍 [PRELOAD] Nenhum dado válido no cache');
    }

    console.log('🔍 [PRELOAD] Criando nova operação de pré-carregamento...');
    // Criar nova operação de pré-carregamento
    const preloadPromise = this.performPreload(userId, {
      includeProfile,
      includeSubscription,
      includePreferences,
      includeNotifications
    });

    this.preloadQueue.set(cacheKey, preloadPromise);
    console.log('🔍 [PRELOAD] Operação adicionada à fila');

    try {
      console.log('🔍 [PRELOAD] Aguardando resultado da operação...');
      const result = await preloadPromise;
      console.log('✅ [PRELOAD] Operação concluída com sucesso:', result);
      
      // Salvar no cache local
      this.setCachedData(cacheKey, result);
      console.log('💾 [PRELOAD] Dados salvos no cache local');
      
      return result;
    } catch (error) {
      console.error('❌ [PRELOAD] Erro na operação:', error);
      throw error;
    } finally {
      // Remover da fila
      this.preloadQueue.delete(cacheKey);
      console.log('🔍 [PRELOAD] Operação removida da fila');
    }
  }

  /**
   * Pré-carrega dados baseado no contexto do usuário
   */
  async preloadByContext(user: User, context: 'login' | 'dashboard' | 'profile'): Promise<PreloadedData> {
    console.log('🔍 [PRELOAD_BY_CONTEXT] Iniciando preloadByContext');
    console.log('🔍 [PRELOAD_BY_CONTEXT] User ID:', user.id);
    console.log('🔍 [PRELOAD_BY_CONTEXT] Context:', context);
    
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

    console.log('🔍 [PRELOAD_BY_CONTEXT] Options para contexto:', contextOptions[context]);
    
    try {
      const result = await this.preloadUserData(user.id, contextOptions[context]);
      console.log('✅ [PRELOAD_BY_CONTEXT] Resultado obtido:', result);
      return result;
    } catch (error) {
      console.error('❌ [PRELOAD_BY_CONTEXT] Erro:', error);
      throw error;
    }
  }

  /**
   * Executa o pré-carregamento real dos dados
   */
  private async performPreload(
    userId: string,
    options: Required<Omit<PreloadOptions, 'useCache'>>
  ): Promise<PreloadedData> {
    console.log('🔍 [PERFORM] Iniciando performPreload para userId:', userId, 'options:', options);
    
    const promises: Promise<any>[] = [];
    const result: PreloadedData = {};

    // Pré-carregar perfil
    if (options.includeProfile) {
      console.log('🔍 [PERFORM] Adicionando preload de profile...');
      promises.push(
        this.preloadProfile(userId).then(profile => {
          console.log('✅ [PERFORM] Profile carregado:', profile);
          result.profile = profile;
        }).catch(error => {
          console.warn('❌ [PERFORM] Erro ao pré-carregar perfil:', error);
          result.profile = null;
        })
      );
    }

    // Pré-carregar assinatura
    if (options.includeSubscription) {
      console.log('🔍 [PERFORM] Adicionando preload de subscription...');
      promises.push(
        this.preloadSubscription(userId).then(subscription => {
          console.log('✅ [PERFORM] Subscription carregada:', subscription);
          result.subscription = subscription;
        }).catch(error => {
          console.warn('❌ [PERFORM] Erro ao pré-carregar assinatura:', error);
          result.subscription = null;
        })
      );
    }

    // Pré-carregar preferências
    if (options.includePreferences) {
      console.log('🔍 [PERFORM] Adicionando preload de preferences...');
      promises.push(
        this.preloadPreferences(userId).then(preferences => {
          console.log('✅ [PERFORM] Preferences carregadas:', preferences);
          result.preferences = preferences;
        }).catch(error => {
          console.warn('❌ [PERFORM] Erro ao pré-carregar preferências:', error);
          result.preferences = null;
        })
      );
    }

    // Pré-carregar notificações
    if (options.includeNotifications) {
      console.log('🔍 [PERFORM] Adicionando preload de notifications...');
      promises.push(
        this.preloadNotifications(userId).then(notifications => {
          console.log('✅ [PERFORM] Notifications carregadas:', notifications);
          result.notifications = notifications;
        }).catch(error => {
          console.warn('❌ [PERFORM] Erro ao pré-carregar notificações:', error);
          result.notifications = null;
        })
      );
    }

    console.log('🔍 [PERFORM] Total de promises criadas:', promises.length);
    console.log('🔍 [PERFORM] Aguardando todas as operações...');
    
    // Aguardar todas as operações
    await Promise.allSettled(promises);
    
    console.log('✅ [PERFORM] Todas as operações concluídas. Resultado final:', result);
    return result;
  }

  /**
   * Pré-carrega dados do perfil
   */
  private async preloadProfile(userId: string): Promise<any> {
    console.log('🔍 [PROFILE] Iniciando preload do profile para userId:', userId);
    
    try {
      // Verificar cache primeiro
      console.log('🔍 [PROFILE] Verificando cache do profile...');
      const cached = ProfileCache.getProfile();
      if (cached && ProfileCache.isValid()) {
        console.log('✅ [PROFILE] Profile encontrado no cache:', cached);
        return cached;
      }
      console.log('🔍 [PROFILE] Cache inválido ou vazio, buscando no banco...');

      console.log('🔍 [PROFILE] Executando query no Supabase...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('🔍 [PROFILE] Resultado da query - data:', data, 'error:', error);

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [PROFILE] Erro na query:', error);
        throw error;
      }

      if (data) {
        console.log('✅ [PROFILE] Profile encontrado, salvando no cache:', data);
        ProfileCache.setProfile(data);
      } else {
        console.log('⚠️ [PROFILE] Nenhum profile encontrado');
      }

      return data;
    } catch (error) {
      console.error('❌ [PROFILE] Erro ao pré-carregar perfil:', error);
      return null;
    }
  }

  /**
   * Pré-carrega dados da assinatura
   */
  private async preloadSubscription(userId: string): Promise<any> {
    console.log('🔍 [SUBSCRIPTION] Iniciando preload da subscription para userId:', userId);
    
    try {
      // Verificar cache primeiro
      console.log('🔍 [SUBSCRIPTION] Verificando cache da subscription...');
      const cached = SubscriptionCache.getSubscription();
      if (cached && SubscriptionCache.isValid()) {
        console.log('✅ [SUBSCRIPTION] Subscription encontrada no cache:', cached);
        return cached;
      }
      console.log('🔍 [SUBSCRIPTION] Cache inválido ou vazio, buscando no banco...');

      console.log('🔍 [SUBSCRIPTION] Executando query no Supabase...');
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('🔍 [SUBSCRIPTION] Resultado da query - data:', data, 'error:', error);

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [SUBSCRIPTION] Erro na query:', error);
        throw error;
      }

      // Salvar no cache
      if (data) {
        console.log('✅ [SUBSCRIPTION] Subscription encontrada, salvando no cache:', data);
        SubscriptionCache.setSubscription(data);
      } else {
        console.log('⚠️ [SUBSCRIPTION] Nenhuma subscription encontrada');
      }

      return data;
    } catch (error) {
      console.error('❌ [SUBSCRIPTION] Erro ao pré-carregar assinatura:', error);
      return null;
    }
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