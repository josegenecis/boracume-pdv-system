
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
        console.error('❌ [useMenuData] Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ [useMenuData] Perfil carregado com sucesso:', data);
      console.log('✅ [useMenuData] Nome do restaurante:', data?.restaurant_name);
      console.log('✅ [useMenuData] Telefone:', data?.phone);
      setProfile(data);
    } catch (error) {
      console.error('❌ [useMenuData] Erro crítico ao carregar dados do restaurante:', error);
      throw error;
    }
  };

  const fetchProducts = async () => {
    try {
      console.log('🔄 [useMenuData] Carregando produtos para userId:', userId);
      console.log('🔄 [useMenuData] Executando query na tabela products...');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true)
        .order('name');

      if (error) {
        console.error('❌ [useMenuData] Erro ao carregar produtos:', error);
        console.error('❌ [useMenuData] Detalhes do erro de produtos:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ [useMenuData] Query de produtos executada com sucesso!');
      console.log('✅ [useMenuData] Produtos encontrados:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('📋 [useMenuData] Lista detalhada de produtos:');
        data.forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.name} - ${product.category} - R$ ${product.price}`);
        });
      } else {
        console.log('⚠️ [useMenuData] Nenhum produto encontrado para este usuário');
        console.log('🔍 [useMenuData] Verificações necessárias:');
        console.log('  - userId está correto?', userId);
        console.log('  - Produtos têm available = true?');
        console.log('  - Produtos têm show_in_delivery = true?');
      }
      
      setProducts(data || []);
      
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean) || [])];
      console.log('🏷️ [useMenuData] Categorias únicas encontradas:', uniqueCategories);
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('❌ [useMenuData] Erro crítico ao carregar produtos:', error);
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
        console.error('❌ [useMenuData] Detalhes do erro de delivery zones:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
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
      console.error('❌ [useMenuData] Verifique se a URL está correta: /cardapio/{userId}');
      return;
    }
    
    console.log('🚀 [useMenuData] =================================');
    console.log('🚀 [useMenuData] INICIANDO CARREGAMENTO COMPLETO');
    console.log('🚀 [useMenuData] UserId:', userId);
    console.log('🚀 [useMenuData] Timestamp:', new Date().toISOString());
    console.log('🚀 [useMenuData] =================================');
    
    setLoading(true);
    
    try {
      console.log('📡 [useMenuData] Testando conexão com Supabase...');
      
      // Teste básico de conexão
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('❌ [useMenuData] Falha na conexão com Supabase:', testError);
        throw new Error('Conexão com banco de dados falhou');
      }
      
      console.log('✅ [useMenuData] Conexão com Supabase OK');
      
      // Carregar dados em paralelo
      console.log('⚡ [useMenuData] Carregando dados em paralelo...');
      await Promise.all([
        fetchRestaurantData(),
        fetchProducts(),
        fetchDeliveryZones()
      ]);
      
      console.log('🎉 [useMenuData] =================================');
      console.log('🎉 [useMenuData] TODOS OS DADOS CARREGADOS COM SUCESSO!');
      console.log('🎉 [useMenuData] =================================');
      
    } catch (error) {
      console.error('💥 [useMenuData] =================================');
      console.error('💥 [useMenuData] ERRO CRÍTICO NO CARREGAMENTO');
      console.error('💥 [useMenuData] Erro:', error);
      console.error('💥 [useMenuData] =================================');
      
      toast({
        title: "Erro no Cardápio",
        description: "Não foi possível carregar o cardápio. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('✅ [useMenuData] Loading finalizado - Estado atual:');
      console.log('  - Loading:', false);
      console.log('  - Profile carregado:', !!profile);
      console.log('  - Produtos:', products.length);
      console.log('  - Categorias:', categories.length);
    }
  };

  useEffect(() => {
    console.log('🔄 [useMenuData] useEffect executado');
    console.log('🔄 [useMenuData] UserId recebido:', userId);
    console.log('🔄 [useMenuData] Tipo do userId:', typeof userId);
    console.log('🔄 [useMenuData] UserId é válido?', !!userId);
    
    if (!userId) {
      console.error('❌ [useMenuData] userId inválido - interrompendo carregamento');
      toast({
        title: "Link Inválido",
        description: "ID do usuário não encontrado na URL. Verifique se o link está correto.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    console.log('✅ [useMenuData] UserId válido - iniciando carregamento...');
    fetchAllData();
  }, [userId]);

  // Log do estado atual sempre que algo mudar
  useEffect(() => {
    console.log('📊 [useMenuData] ESTADO ATUAL:');
    console.log('  - Loading:', loading);
    console.log('  - Profile existe:', !!profile);
    console.log('  - Profile nome:', profile?.restaurant_name);
    console.log('  - Produtos:', products.length);
    console.log('  - Categorias:', categories.length);
    console.log('  - Delivery zones:', deliveryZones.length);
  }, [loading, profile, products, categories, deliveryZones]);

  return {
    products,
    categories,
    loading,
    profile,
    deliveryZones
  };
};
