import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { debugLogger } from '@/utils/debugLogger';
import { debugLog, measurePerformance } from '@/utils/debugSystem';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category_id: string;
  is_available: boolean;
  variations?: any[];
}

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

interface RestaurantProfile {
  id: string;
  restaurant_name: string;
  description?: string;
  logo_url?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
}

// Informações do navegador otimizadas
const getBrowserInfo = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return {
    isSafari: /safari/.test(userAgent) && !/chrome/.test(userAgent),
    isMobile: /mobile|android|iphone|ipad/.test(userAgent)
  };
};

// Cache keys
const MENU_CACHE_KEYS = {
  PRODUCTS: 'boracume_menu_products',
  CATEGORIES: 'boracume_menu_categories', 
  PROFILE: 'boracume_menu_profile',
  DELIVERY_ZONES: 'boracume_menu_delivery_zones',
  EXPIRY: 'boracume_menu_cache_expiry'
};

const CACHE_DURATION = 5 * 60 * 1000; // REDUZIDO para 5 minutos

// Função otimizada para verificar storage
const getAvailableStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return 0;
    
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Estimar storage disponível (5MB típico)
    const total = 5 * 1024 * 1024;
    return Math.max(0, total - used);
  } catch {
    return 0;
  }
};

// Cache otimizado com verificação de espaço
const saveToCache = (key: string, data: any) => {
  try {
    const serialized = JSON.stringify(data);
    const available = getAvailableStorage();
    
    if (serialized.length > available) {
      console.warn('⚠️ [CACHE] Espaço insuficiente - limpando cache antigo');
      clearMenuCache();
    }
    
    localStorage.setItem(key, serialized);
    localStorage.setItem(MENU_CACHE_KEYS.EXPIRY, Date.now().toString());
  } catch (error) {
    console.warn('⚠️ [CACHE] Erro ao salvar cache:', error);
  }
};

// Load otimizado do cache
const loadFromCache = (key: string): any | null => {
  try {
    const expiry = localStorage.getItem(MENU_CACHE_KEYS.EXPIRY);
    if (!expiry || Date.now() - parseInt(expiry) > CACHE_DURATION) {
      console.log('🗑️ [CACHE] Cache expirado - limpando');
      clearMenuCache();
      return null;
    }
    
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    return JSON.parse(cached);
  } catch (error) {
    console.warn('⚠️ [CACHE] Erro ao carregar cache:', error);
    return null;
  }
};

// Clear cache otimizado
const clearMenuCache = () => {
  try {
    Object.values(MENU_CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🗑️ [CACHE] Cache limpo');
  } catch (error) {
    console.warn('⚠️ [CACHE] Erro ao limpar cache:', error);
  }
};

export const useMenuData = (userId: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs para controle de debounce e cleanup
  const isMountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const browserInfo = getBrowserInfo();

  // Função otimizada para buscar dados do restaurante
  const fetchRestaurantData = async (): Promise<RestaurantProfile | null> => {
    const performanceTracker = measurePerformance('useMenuData', 'fetchRestaurantData');
    debugLog('useMenuData', 'fetchRestaurantData_start', { userId });
    debugLogger.menu('fetching_restaurant_profile', { userId });
    
    // Cache primeiro
    const cachedProfile = loadFromCache(MENU_CACHE_KEYS.PROFILE);
    if (cachedProfile) {
      debugLog('useMenuData', 'profile_cache_hit', { profileId: cachedProfile.id });
      debugLogger.menu('profile_loaded_from_cache', { profileId: cachedProfile.id });
      performanceTracker.end({ source: 'cache' });
      return cachedProfile;
    }
    
    // Timeout ajustado para 6 segundos para perfil
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento do perfil')), 6000)
    );
    
    const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

    if (error) {
      debugLogger.menu('profile_fetch_error', { error: error.message }, 'error');
      throw error;
    }

    if (data) {
      console.log('✅ [MENU] Perfil carregado:', data.restaurant_name);
      saveToCache(MENU_CACHE_KEYS.PROFILE, data);
      return data;
    }

    return null;
  };

  // Função otimizada para buscar produtos
  const fetchProducts = async (): Promise<Product[]> => {
    console.log('🔄 [MENU] Buscando produtos...');
    
    // Cache primeiro
    const cachedProducts = loadFromCache(MENU_CACHE_KEYS.PRODUCTS);
    if (cachedProducts) {
      console.log('✅ [MENU] Produtos do cache:', cachedProducts.length);
      return cachedProducts;
    }
    
    // Timeout ajustado para 6 segundos para produtos
    const productsPromise = supabase
      .from('products')
      .select(`
        *,
        product_variations (
          id,
          name,
          price,
          required,
          max_selections
        )
      `)
      .eq('user_id', userId)
      .eq('is_available', true)
      .order('name');
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento dos produtos')), 6000)
    );

    const { data, error } = await Promise.race([productsPromise, timeoutPromise]) as any;

    if (error) {
      console.error('❌ [MENU] Erro nos produtos:', error);
      throw error;
    }

    const products = data || [];
    console.log('✅ [MENU] Produtos carregados:', products.length);
    
    // Processar variações
    const processedProducts = products.map(product => ({
      ...product,
      variations: product.product_variations || []
    }));
    
    saveToCache(MENU_CACHE_KEYS.PRODUCTS, processedProducts);
    return processedProducts;
  };

  // Função otimizada para buscar categorias
  const fetchCategories = async (): Promise<Category[]> => {
    console.log('🔄 [MENU] Buscando categorias...');
    
    // Cache primeiro
    const cachedCategories = loadFromCache(MENU_CACHE_KEYS.CATEGORIES);
    if (cachedCategories) {
      console.log('✅ [MENU] Categorias do cache:', cachedCategories.length);
      return cachedCategories;
    }
    
    // Timeout ajustado para 6 segundos para categorias
    const categoriesPromise = supabase
      .from('product_categories')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento das categorias')), 6000)
    );

    const { data, error } = await Promise.race([categoriesPromise, timeoutPromise]) as any;

    if (error) {
      console.error('❌ [MENU] Erro nas categorias:', error);
      throw error;
    }

    const categories = data || [];
    console.log('✅ [MENU] Categorias carregadas:', categories.length);
    
    saveToCache(MENU_CACHE_KEYS.CATEGORIES, categories);
    return categories;
  };

  // Função otimizada para buscar zonas de entrega
  const fetchDeliveryZones = async (): Promise<DeliveryZone[]> => {
    console.log('🔄 [MENU] Buscando zonas de entrega...');
    
    // Cache primeiro
    const cachedZones = loadFromCache(MENU_CACHE_KEYS.DELIVERY_ZONES);
    if (cachedZones) {
      console.log('✅ [MENU] Zonas do cache:', cachedZones.length);
      return cachedZones;
    }
    
    // Timeout ajustado para 6 segundos para zonas
    const zonesPromise = supabase
      .from('delivery_zones')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento das zonas')), 6000)
    );

    const { data, error } = await Promise.race([zonesPromise, timeoutPromise]) as any;

    if (error) {
      console.error('❌ [MENU] Erro nas zonas:', error);
      throw error;
    }

    const zones = data || [];
    console.log('✅ [MENU] Zonas carregadas:', zones.length);
    
    saveToCache(MENU_CACHE_KEYS.DELIVERY_ZONES, zones);
    return zones;
  };

  // Função principal otimizada - SEM RETRY AGRESSIVO
  const fetchAllData = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId) {
      console.log('⚠️ [MENU] Sem userId - pulando fetch');
      setIsLoading(false);
      return;
    }

    // Evitar múltiplas chamadas muito próximas - REDUZIDO para 1 segundo
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < 1000) {
      console.log('⚠️ [MENU] Fetch muito recente - ignorando');
      return;
    }
    
    lastFetchTimeRef.current = now;
    
    console.log('🔄 [MENU] === INÍCIO FETCH DADOS ===');
    setIsLoading(true);
    setError(null);

    // Timeout global ajustado para 8 segundos
    const globalTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        console.log('⏰ [MENU] Timeout global (8s) - finalizando');
        setIsLoading(false);
        setError('Timeout no carregamento dos dados');
      }
    }, 8000);

    try {
      if (forceRefresh) {
        clearMenuCache();
      }

      // Buscar dados em paralelo com Promise.allSettled
      const [profileResult, productsResult, categoriesResult, zonesResult] = await Promise.allSettled([
        fetchRestaurantData(),
        fetchProducts(),
        fetchCategories(),
        fetchDeliveryZones()
      ]);

      if (!isMountedRef.current) return;

      // Processar resultados
      if (profileResult.status === 'fulfilled' && profileResult.value) {
        setProfile(profileResult.value);
      } else {
        console.error('❌ [MENU] Falha no perfil:', profileResult.status === 'rejected' ? profileResult.reason : 'Sem dados');
      }

      if (productsResult.status === 'fulfilled') {
        setProducts(productsResult.value);
      } else {
        console.error('❌ [MENU] Falha nos produtos:', productsResult.reason);
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
      } else {
        console.error('❌ [MENU] Falha nas categorias:', categoriesResult.reason);
      }

      if (zonesResult.status === 'fulfilled') {
        setDeliveryZones(zonesResult.value);
      } else {
        console.error('❌ [MENU] Falha nas zonas:', zonesResult.reason);
      }

      // Verificar se pelo menos alguns dados foram carregados
      const hasData = profileResult.status === 'fulfilled' || 
                     productsResult.status === 'fulfilled' || 
                     categoriesResult.status === 'fulfilled';

      if (hasData) {
        console.log('✅ [MENU] Dados carregados com sucesso');
        toast.success('Cardápio carregado com sucesso!');
      } else {
        console.error('❌ [MENU] Falha total no carregamento');
        setError('Erro ao carregar dados do cardápio');
        toast.error('Erro ao carregar cardápio. Tente novamente.');
      }

    } catch (error) {
      console.error('💥 [MENU] Erro crítico:', error);
      if (isMountedRef.current) {
        setError('Erro ao carregar dados do cardápio');
        toast.error('Erro ao carregar cardápio. Verifique sua conexão.');
      }
    } finally {
      clearTimeout(globalTimeout);
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      console.log('🔄 [MENU] === FIM FETCH DADOS ===');
    }
  }, [userId]);

  // Função para refresh manual
  const refreshData = useCallback(() => {
    console.log('🔄 [MENU] Refresh manual solicitado');
    fetchAllData(true);
  }, [fetchAllData]);

  // Effect otimizado com debounce
  useEffect(() => {
    isMountedRef.current = true;
    
    debugLog('useMenuData', 'useEffect_triggered', { 
      userId,
      hasUserId: !!userId,
      browserInfo 
    });
    
    if (!userId) {
      debugLog('useMenuData', 'no_userId', { userId });
      setIsLoading(false);
      return;
    }

    // Debounce para evitar múltiplas chamadas
    if (fetchTimeoutRef.current) {
      debugLog('useMenuData', 'clearing_previous_timeout', {});
      clearTimeout(fetchTimeoutRef.current);
    }

    // Delay mínimo para Safari/Mobile
    const delay = browserInfo.isSafari ? 200 : (browserInfo.isMobile ? 100 : 0);
    
    debugLog('useMenuData', 'scheduling_fetch', { delay, browserInfo });
    
    fetchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        debugLog('useMenuData', 'loadData', { userId });
        fetchAllData();
      }
    }, delay);

    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [userId, fetchAllData]);

  return {
    products,
    categories,
    profile,
    deliveryZones,
    isLoading,
    error,
    refreshData
  };
};