
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  category?: string;
  user_id: string;
  available: boolean;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

export const useMenuData = (userId: string | null) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const fetchRestaurantData = async () => {
    try {
      console.log('🔄 Carregando dados do restaurante para userId:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        throw error;
      }

      console.log('✅ Perfil carregado:', data);
      setProfile(data);
    } catch (error) {
      console.error('❌ Erro ao carregar dados do restaurante:', error);
      throw error;
    }
  };

  const fetchProducts = async () => {
    try {
      console.log('🔄 Carregando produtos para userId:', userId);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        throw error;
      }

      console.log('✅ Produtos carregados:', data?.length || 0);
      setProducts(data || []);
      
      // Criar categorias a partir dos produtos únicos
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean) || [])];
      const categoryObjects: Category[] = uniqueCategories.map((name, index) => ({
        id: `cat-${index}`,
        name,
        description: `Categoria ${name}`
      }));
      setCategories(categoryObjects);
      
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      throw error;
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      console.log('🔄 Carregando zonas de entrega para userId:', userId);
      
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar zonas de entrega:', error);
        throw error;
      }

      console.log('✅ Zonas de entrega carregadas:', data?.length || 0);
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar zonas de entrega:', error);
    }
  };

  const fetchAllData = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchRestaurantData(),
        fetchProducts(),
        fetchDeliveryZones()
      ]);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio. Verifique se o link está correto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Link inválido. ID do usuário não encontrado.",
        variant: "destructive",
      });
      return;
    }

    fetchAllData();
  }, [userId]);

  return {
    products,
    categories,
    loading,
    profile,
    deliveryZones
  };
};
