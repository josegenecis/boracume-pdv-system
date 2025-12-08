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
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        // Verificar cache primeiro
        if (enableCache) {
          const cachedData = getCachedData(userId);
          if (cachedData) {
            setData(cachedData);
            return;
          }
        }

        // Buscar perfil do restaurante
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, restaurant_name, description, logo_url, phone, address, opening_hours')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;

        // Buscar categorias
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('product_categories')
          .select('id, name, description, display_order')
          .eq('user_id', userId)
          .order('display_order', { ascending: true });

        if (categoriesError) throw categoriesError;

        // Buscar produtos disponíveis
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            *,
            product_categories!inner(name)
          `)
          .eq('user_id', userId)
          .eq('is_available', true)
          .eq('show_in_delivery', true)
          .order('name', { ascending: true });

        if (productsError) throw productsError;

        // Buscar zonas de entrega
        const { data: deliveryZonesData, error: deliveryZonesError } = await supabase
          .from('delivery_zones')
          .select('id, name, delivery_fee, minimum_order, delivery_time, active')
          .eq('user_id', userId)
          .eq('active', true)
          .order('name', { ascending: true });

        if (deliveryZonesError) throw deliveryZonesError;

        // Processar produtos
        const processedProducts = (productsData || []).map(product => ({
          ...product,
          category_name: product.product_categories?.name
        }));

        // Separar destaques
        const highlights = processedProducts
          .filter(product => product.is_highlight)
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 6); // Limitar a 6 destaques

        const menuData: MenuData = {
          products: processedProducts,
          categories: categoriesData || [],
          highlights,
          profile: profileData,
          deliveryZones: deliveryZonesData || [],
          isLoading: false,
          error: null
        };

        setData(menuData);

        // Salvar no cache
        if (enableCache) {
          setCachedData(userId, menuData);
        }

      } catch (error) {
        console.error('Erro ao buscar dados do menu:', error);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Erro ao carregar o cardápio. Tente novamente.'
        }));
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, enableCache]);

  return data;
};