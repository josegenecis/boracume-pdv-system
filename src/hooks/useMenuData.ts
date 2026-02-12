import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  image_url?: string;
  is_available: boolean;
  show_in_delivery: boolean;
  is_highlight: boolean;
  order_count: number;
  category_id: string;
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
  active: boolean;
}

interface MenuData {
  products: Product[];
  categories: Category[];
  highlights: Product[];
  profile: RestaurantProfile | null;
  deliveryZones: DeliveryZone[];
  isLoading: boolean;
  error: string | null;
}

interface UseMenuDataOptions {
  userId: string;
  enableCache?: boolean;
  cacheTTL?: number; // em minutos
}

// Cache simples com localStorage
const CACHE_KEY = 'boracume_menu_data';
const DEFAULT_CACHE_TTL = 5; // 5 minutos

const getCachedData = (userId: string): MenuData | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    const ttl = DEFAULT_CACHE_TTL * 60 * 1000; // converter para milissegundos
    
    if (now - timestamp > ttl) {
      localStorage.removeItem(`${CACHE_KEY}_${userId}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar cache:', error);
    return null;
  }
};

const setCachedData = (userId: string, data: MenuData) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Erro ao salvar cache:', error);
  }
};

export const useMenuData = ({ userId, enableCache = true }: UseMenuDataOptions): MenuData => {
  const [data, setData] = useState<MenuData>({
    products: [],
    categories: [],
    highlights: [],
    profile: null,
    deliveryZones: [],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      // 1. Verificar cache primeiro (Instantâneo)
      const cacheKey = `menu_data_${userId}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const { timestamp, data } = JSON.parse(cachedData);
          // Cache válido por 15 minutos (aumentado para melhor UX)
          if (Date.now() - timestamp < 15 * 60 * 1000) {
            console.log('📦 Usando dados do cache local');
            if (mounted) {
              const highlightsData = (data.products || [])
              .filter((p: any) => p.is_highlight)
              .sort((a: any, b: any) => (b.order_count || 0) - (a.order_count || 0))
              .slice(0, 6);

              setData({
                products: data.products || [],
                categories: data.categories || [],
                profile: data.profile,
                deliveryZones: data.deliveryZones || [],
                highlights: highlightsData || [],
                isLoading: false,
                error: null
              });
            }
          }
        } catch (e) {
          console.warn('Erro ao ler cache', e);
        }
      }

      // 2. Buscar dados atualizados diretamente do Supabase (Mais rápido que Edge Function fria)
      // Disparamos isso em paralelo, sem esperar (mas atualiza o estado quando chegar)
      try {
        const [
          { data: profilesArr, error: profileError },
          { data: categoriesData, error: categoriesError },
          { data: productsData, error: productsError },
          { data: deliveryZonesData, error: deliveryZonesError }
        ] = await Promise.all([
          // Buscar perfil do restaurante
          supabase
            .from('profiles')
            .select('id, restaurant_name, description, logo_url, phone, address, opening_hours')
            .eq('id', userId)
            .limit(1) as any,
          // Buscar categorias
          supabase
            .from('product_categories')
            .select('id, name, description, display_order')
            .eq('user_id', userId)
            .order('display_order', { ascending: true }) as any,
          // Buscar produtos disponíveis
          (supabase
            .from('products') as any)
            .select(`
              *,
              product_categories!inner(name)
            `)
            .eq('user_id', userId)
            .eq('is_available', true)
            .order('name', { ascending: true }),
          // Buscar zonas de entrega
          supabase
            .from('delivery_zones')
            .select('id, name, delivery_fee, minimum_order, delivery_time, active')
            .eq('user_id', userId)
            .eq('active', true)
            .order('name', { ascending: true }) as any
        ]);

        if (profileError) {
           if ((profileError as any)?.code !== 'PGRST116') console.warn('Erro perfil:', profileError);
        }
        if (categoriesError) throw categoriesError;
        if (productsError) throw productsError;
        if (deliveryZonesError) throw deliveryZonesError;

        // Processar dados
        const processedProducts = ((productsData || []) as any[]).map((p: any) => {
          const price = Number(p?.price) || 0;
          const original = p?.original_price !== undefined && p?.original_price !== null ? Number(p.original_price) : null;
          const discountPct = p?.discount_percentage !== undefined && p?.discount_percentage !== null ? Number(p.discount_percentage) : null;
          if (original && discountPct && discountPct > 0) {
            const expectedDiscounted = Number((original * (1 - discountPct / 100)).toFixed(2));
            if (price >= original - 0.009) {
              return { ...p, price: expectedDiscounted };
            }
          }
          return p;
        });
        const highlights = processedProducts
          .filter(p => p.is_highlight)
          .sort((a, b) => (b.order_count || 0) - (a.order_count || 0))
          .slice(0, 6);

        const profileData = Array.isArray(profilesArr) && profilesArr.length > 0 ? profilesArr[0] : null;
        const fallbackProfile = profileData ? profileData : {
          id: userId,
          restaurant_name: 'Cardápio',
          description: '',
          logo_url: '',
          phone: '',
          address: '',
          opening_hours: ''
        } as RestaurantProfile;

        const menuData: MenuData = {
          products: processedProducts as any,
          categories: categoriesData || [],
          highlights,
          profile: fallbackProfile,
          deliveryZones: deliveryZonesData || [],
          isLoading: false,
          error: null
        };

        if(mounted) {
          setData(menuData);
          // Atualizar cache com dados frescos
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: { 
              products: processedProducts,
              categories: categoriesData,
              profile: fallbackProfile,
              deliveryZones: deliveryZonesData
             }
          }));
        }

      } catch (err) {
        console.error('Erro ao buscar dados atualizados:', err);
        if (mounted && !cachedData) {
          setData(prev => ({ ...prev, isLoading: false, error: 'Erro ao carregar cardápio.' }));
        }
      }
    };

    if (userId) {
      fetchData();
    }
    
    return () => { mounted = false; };
  }, [userId, enableCache]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`menu-realtime-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_zones', filter: `user_id=eq.${userId}` }, () => {
        // refetch delivery zones
        supabase
          .from('delivery_zones')
          .select('id, name, delivery_fee, minimum_order, delivery_time, active')
          .eq('user_id', userId)
          .eq('active', true)
          .order('name', { ascending: true })
          .then(({ data: dz }) => {
            setData(prev => ({ ...prev, deliveryZones: dz || [] }));
          });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${userId}` }, () => {
        (supabase
          .from('products') as any)
          .select('*')
          .eq('user_id', userId)
          .eq('is_available', true)
          .eq('show_in_delivery', true)
          .order('name', { ascending: true })
          .then(({ data: productsData }: any) => {
            const processedProducts = (productsData || []) as any[];
            setData(prev => ({ ...prev, products: processedProducts as any } as any));
          });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_categories', filter: `user_id=eq.${userId}` }, () => {
        supabase
          .from('product_categories')
          .select('id, name, description, display_order')
          .eq('user_id', userId)
          .order('display_order', { ascending: true })
          .then(({ data: categoriesData }) => {
            setData(prev => ({ ...prev, categories: categoriesData || [] }));
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return data;
};
