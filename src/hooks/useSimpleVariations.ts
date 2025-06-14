import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VariationOption {
  name: string;
  price: number;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
}

export const useSimpleVariations = () => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchVariations = async (productId: string): Promise<ProductVariation[]> => {
    console.log('🔄 HOOK - Iniciando busca de variações para produto:', productId);
    setIsLoading(true);
    
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

      // Buscar variações globais associadas
      const { data: globalLinks, error: globalLinksError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      console.log('📋 CARDÁPIO DIGITAL - Query links globais resultado:', {
        data: globalLinks,
        error: globalLinksError,
        count: globalLinks?.length || 0
      });

      let globalVariations: any[] = [];
      if (globalLinks && globalLinks.length > 0) {
        const globalIds = globalLinks.map(link => link.global_variation_id);
        console.log('🔍 CARDÁPIO DIGITAL - IDs das variações globais a buscar:', globalIds);
        
        const { data: globals, error: globalVarsError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalIds);
        
        console.log('📋 CARDÁPIO DIGITAL - Query variações globais resultado:', {
          data: globals,
          error: globalVarsError,
          count: globals?.length || 0
        });
        
        if (globals) globalVariations = globals;
      }

      // Combinar e formatar variações
      const allVariations = [...(productVariations || []), ...globalVariations];
      
      console.log('🔄 CARDÁPIO DIGITAL - Combinando variações:', {
        especificas: productVariations?.length || 0,
        globais: globalVariations.length,
        total: allVariations.length,
        dados: allVariations
      });
      
      const formatted: ProductVariation[] = [];
      
      for (const item of allVariations) {
        console.log('🔄 CARDÁPIO DIGITAL - Processando variação:', item.name, item);
        
        try {
          // Verificar se tem dados básicos válidos
          if (!item || !item.id || !item.name) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem dados básicos:', item);
            continue;
          }

          // Verificar se tem opções válidas
          if (!item.options || !Array.isArray(item.options) || item.options.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem opções válidas:', item.name);
            continue;
          }

          // Processar opções
          const validOptions = item.options
            .filter((opt: any) => opt && opt.name && String(opt.name).trim().length > 0)
            .map((opt: any) => ({
              name: String(opt.name).trim(),
              price: Number(opt.price) >= 0 ? Number(opt.price) : 0
            }));

          if (validOptions.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Nenhuma opção válida encontrada para:', item.name);
            continue;
          }

          const processedVariation: ProductVariation = {
            id: item.id,
            name: String(item.name || '').trim(),
            required: Boolean(item.required),
            max_selections: Math.max(1, Number(item.max_selections) || 1),
            options: validOptions
          };

          formatted.push(processedVariation);
          console.log('✅ CARDÁPIO DIGITAL - Variação processada:', processedVariation.name, 'com', processedVariation.options.length, 'opções válidas');
        } catch (itemError) {
          console.error('❌ CARDÁPIO DIGITAL - Erro ao processar variação:', itemError, item);
        }
      }
      
      console.log('🎯 HOOK - RESULTADO FINAL:', {
        total: formatted.length,
        variações: formatted.map(v => ({ name: v.name, opções: v.options.length, required: v.required }))
      });

      return formatted;
    } catch (error) {
      console.error('Erro ao buscar variações:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const calculateVariationPrice = (selectedVariations: Record<string, string[]>, variations: ProductVariation[]) => {
    let total = 0;
    
    variations.forEach(variation => {
      const selected = selectedVariations[variation.id] || [];
      selected.forEach(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        if (option) total += option.price;
      });
    });
    
    return total;
  };

  const getSelectedVariationsText = (selectedVariations: Record<string, string[]>) => {
    const texts: string[] = [];
    Object.values(selectedVariations).forEach(options => {
      texts.push(...options);
    });
    return texts;
  };

  return {
    isLoading,
    fetchVariations,
    calculateVariationPrice,
    getSelectedVariationsText
  };
};