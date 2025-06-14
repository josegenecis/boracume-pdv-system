import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';

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

interface ProductVariation {
  id: string;
  name: string;
  options: Array<{
    name: string;
    price: number;
  }>;
  max_selections: number;
  required: boolean;
}

export const useProductVariations = () => {
  const { toast } = useToast();
  const { addToCart } = useDigitalMenuCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [showVariationModal, setShowVariationModal] = useState(false);

  const fetchProductVariations = async (productId: string): Promise<ProductVariation[]> => {
    console.log('🔄 CARDÁPIO DIGITAL - Iniciando busca de variações para produto:', productId);
    
    try {
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      console.log('📋 CARDÁPIO DIGITAL - Query variações específicas resultado:', {
        data: productVariations,
        error: productError,
        count: productVariations?.length || 0
      });

      // Buscar IDs das variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalLinksError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      console.log('📋 CARDÁPIO DIGITAL - Query links globais resultado:', {
        data: globalVariationLinks,
        error: globalLinksError,
        count: globalVariationLinks?.length || 0
      });

      // Buscar dados das variações globais se existirem links
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        console.log('🔍 CARDÁPIO DIGITAL - IDs das variações globais a buscar:', globalVariationIds);
        
        const { data: globalVars, error: globalVarsError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        console.log('📋 CARDÁPIO DIGITAL - Query variações globais resultado:', {
          data: globalVars,
          error: globalVarsError,
          count: globalVars?.length || 0
        });

        if (!globalVarsError && globalVars) {
          globalVariations = globalVars;
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];

      console.log('🔄 CARDÁPIO DIGITAL - Combinando variações:', {
        especificas: productVariations?.length || 0,
        globais: globalVariations.length,
        total: allVariations.length,
        dados: allVariations
      });
      
      // Processar e formatar as variações - VALIDAÇÃO SIMPLIFICADA
      const formattedVariations: ProductVariation[] = [];
      
      for (const item of allVariations) {
        console.log('🔄 CARDÁPIO DIGITAL - Processando variação:', item.name, item);
        
        try {
          // Verificar se tem dados básicos válidos
          if (!item || !item.id || !item.name) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem dados básicos:', item);
            continue;
          }

          // Verificar se tem opções válidas - ACEITAR PREÇO ZERO
          if (!item.options || !Array.isArray(item.options) || item.options.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem opções válidas:', item.name);
            continue;
          }

          // Processar opções - SIMPLIFICADO: apenas verificar se tem nome
          const validOptions = item.options
            .filter((opt: any) => opt && opt.name && String(opt.name).trim().length > 0)
            .map((opt: any) => ({
              name: String(opt.name).trim(),
              price: Number(opt.price) >= 0 ? Number(opt.price) : 0 // Aceitar preço zero
            }));

          if (validOptions.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Nenhuma opção válida encontrada para:', item.name);
            continue;
          }

          const formatted: ProductVariation = {
            id: item.id,
            name: String(item.name || '').trim(),
            options: validOptions,
            max_selections: Math.max(1, Number(item.max_selections) || 1),
            required: Boolean(item.required)
          };

          formattedVariations.push(formatted);
          console.log('✅ CARDÁPIO DIGITAL - Variação processada:', formatted.name, 'com', formatted.options.length, 'opções válidas');
        } catch (itemError) {
          console.error('❌ CARDÁPIO DIGITAL - Erro ao processar variação:', itemError, item);
        }
      }
      
      console.log('🎯 CARDÁPIO DIGITAL - RESULTADO FINAL:', {
        total: formattedVariations.length,
        variações: formattedVariations.map(v => ({ name: v.name, opções: v.options.length }))
      });
      
      return formattedVariations;
    } catch (error) {
      console.error('❌ Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const handleProductClick = async (product: Product) => {
    console.log('🚀 CARDÁPIO DIGITAL - CLICK NO PRODUTO:', product.name, 'ID:', product.id);
    
    // Forçar console log para garantir que está sendo chamado
    alert(`DEBUG: Clicou no produto ${product.name}`);
    
    try {
      console.log('🔄 CARDÁPIO DIGITAL - Buscando variações...');
      const variations = await fetchProductVariations(product.id);
      
      console.log('📊 CARDÁPIO DIGITAL - Resultado busca variações:', {
        total: variations.length,
        variações: variations.map(v => v.name)
      });
      
      // Forçar log das variações
      alert(`DEBUG: Encontradas ${variations.length} variações`);
      
      if (variations && variations.length > 0) {
        console.log('✅ CARDÁPIO DIGITAL - PRODUTO TEM VARIAÇÕES! Abrindo modal...');
        alert(`DEBUG: Abrindo modal com ${variations.length} variações`);
        
        setSelectedProduct(product);
        setProductVariations(variations);
        setShowVariationModal(true);
        
        // Confirmar que os estados foram definidos
        console.log('🔧 CARDÁPIO DIGITAL - Estados definidos:', {
          selectedProduct: product.name,
          variationsCount: variations.length,
          modalShouldOpen: true
        });
        
        // Verificar estado após definir
        setTimeout(() => {
          console.log('🔍 CARDÁPIO DIGITAL - Verificando estados após 100ms:', {
            showVariationModal,
            selectedProduct: selectedProduct?.name,
            variationsCount: productVariations.length
          });
        }, 100);
      } else {
        console.log('➡️ CARDÁPIO DIGITAL - Produto sem variações, adicionando direto ao carrinho');
        addToCart(product, 1, [], '');
        toast({
          title: "Produto adicionado!",
          description: `${product.name} foi adicionado ao carrinho.`,
        });
      }
    } catch (error) {
      console.error('❌ CARDÁPIO DIGITAL - Erro crítico ao buscar variações:', error);
      alert(`DEBUG: Erro ao buscar variações: ${error}`);
      // Em caso de erro, adicionar sem variações
      addToCart(product, 1, [], '');
      toast({
        title: "Produto adicionado!",
        description: `${product.name} foi adicionado ao carrinho.`,
      });
    }
  };

  const handleAddToCart = (product: Product, quantity: number, selectedVariations: any[], notes: string) => {
    console.log('🔄 Adicionando produto personalizado ao carrinho:', {
      product: product.name,
      quantity,
      variations: selectedVariations,
      notes
    });
    
    addToCart(product, quantity, selectedVariations, notes);
    setShowVariationModal(false);
    setSelectedProduct(null);
    setProductVariations([]);
  };

  const closeVariationModal = () => {
    console.log('🔒 CARDÁPIO DIGITAL - Fechando modal de variações');
    setShowVariationModal(false);
    setSelectedProduct(null);
    setProductVariations([]);
  };

  return {
    selectedProduct,
    productVariations,
    showVariationModal,
    handleProductClick,
    handleAddToCart,
    closeVariationModal
  };
};