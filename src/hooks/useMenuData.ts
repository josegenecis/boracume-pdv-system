
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

export const useMenuData = (userId: string | null) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const fetchRestaurantData = async () => {
    try {
      console.log('🔄 [useMenuData] Carregando dados do restaurante para userId:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ [useMenuData] Erro ao carregar perfil:', error);
        throw error;
      }

      console.log('✅ [useMenuData] Perfil carregado:', data);
      setProfile(data);
    } catch (error) {
      console.error('❌ [useMenuData] Erro ao carregar dados do restaurante:', error);
      throw error;
    }
  };

  const fetchProducts = async () => {
    try {
      console.log('🔄 [useMenuData] Carregando produtos para userId:', userId);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true)
        .order('name');

      if (error) {
        console.error('❌ [useMenuData] Erro ao carregar produtos:', error);
        throw error;
      }

      console.log('✅ [useMenuData] Produtos carregados:', data?.length || 0, 'produtos');
      console.log('📋 [useMenuData] Lista de produtos:', data?.map(p => ({ name: p.name, category: p.category })));
      
      setProducts(data || []);
      
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean) || [])];
      console.log('🏷️ [useMenuData] Categorias encontradas:', uniqueCategories);
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('❌ [useMenuData] Erro ao carregar produtos:', error);
      throw error;
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      console.log('🔄 [useMenuData] Carregando zonas de entrega para userId:', userId);
      
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ [useMenuData] Erro ao carregar zonas de entrega:', error);
        throw error;
      }

      console.log('✅ [useMenuData] Zonas de entrega carregadas:', data?.length || 0);
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('❌ [useMenuData] Erro ao carregar zonas de entrega:', error);
    }
  };

  const fetchAllData = async () => {
    if (!userId) {
      console.error('❌ [useMenuData] userId é null, não é possível carregar dados');
      return;
    }
    
    console.log('🚀 [useMenuData] Iniciando carregamento de todos os dados...');
    setLoading(true);
    
    try {
      await Promise.all([
        fetchRestaurantData(),
        fetchProducts(),
        fetchDeliveryZones()
      ]);
      console.log('🎉 [useMenuData] Todos os dados carregados com sucesso!');
    } catch (error) {
      console.error('❌ [useMenuData] Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio. Verifique se o link está correto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('✅ [useMenuData] Loading finalizado');
    }
  };

  useEffect(() => {
    console.log('🔄 [useMenuData] useEffect executado com userId:', userId);
    
    if (!userId) {
      console.error('❌ [useMenuData] userId inválido');
      toast({
        title: "Erro",
        description: "Link inválido. ID do usuário não encontrado.",
        variant: "destructive",
      });
      setLoading(false);
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
