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
      // Buscar apenas variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      console.log('📋 CARDÁPIO DIGITAL - Query variações específicas resultado:', {
        data: productVariations,
        error: productError,
        count: productVariations?.length || 0
      });

      if (productError) {
        console.error('❌ CARDÁPIO DIGITAL - Erro ao buscar variações:', productError);
        return [];
      }

      // Usar apenas variações específicas (sem variações globais)
      const allVariations = productVariations || [];
      
      console.log('🔄 CARDÁPIO DIGITAL - Usando apenas variações específicas:', {
        especificas: productVariations?.length || 0,
        total: allVariations.length,
        dados: allVariations
      });
      
      const formatted: ProductVariation[] = [];
      
      for (const item of allVariations) {
        console.log('🔄 CARDÁPIO DIGITAL - Processando variação:', item.name);
        console.log('🔍 CARDÁPIO DIGITAL - Dados brutos da variação:', JSON.stringify(item, null, 2));
        
        try {
          // Verificar se tem dados básicos válidos - mais tolerante
          if (!item || !item.id) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem ID:', item);
            continue;
          }

          if (!item.name || String(item.name).trim() === '') {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem nome:', item);
            continue;
          }

          // Verificar opções com logs detalhados
          console.log('🔍 CARDÁPIO DIGITAL - Verificando opções para:', item.name, 'Opções:', item.options);
          
          if (!item.options) {
            console.log('⚠️ CARDÁPIO DIGITAL - Propriedade options não existe para:', item.name);
            continue;
          }

          if (!Array.isArray(item.options)) {
            console.log('⚠️ CARDÁPIO DIGITAL - Options não é array para:', item.name, 'Tipo:', typeof item.options);
            continue;
          }

          if (item.options.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Array de options vazio para:', item.name);
            continue;
          }

          // Processar opções com validação mais tolerante
          const validOptions = [];
          
          for (let i = 0; i < item.options.length; i++) {
            const opt = item.options[i] as any;
            console.log(`🔍 CARDÁPIO DIGITAL - Processando opção ${i + 1}:`, opt);
            
            if (!opt) {
              console.log(`⚠️ CARDÁPIO DIGITAL - Opção ${i + 1} é null/undefined`);
              continue;
            }

            if (!opt.name || String(opt.name).trim() === '') {
              console.log(`⚠️ CARDÁPIO DIGITAL - Opção ${i + 1} sem nome válido:`, opt);
              continue;
            }

            const optionName = String(opt.name).trim();
            const optionPrice = opt.price !== undefined && opt.price !== null ? Number(opt.price) : 0;
            
            // Garantir que price seja um número válido
            const finalPrice = isNaN(optionPrice) ? 0 : Math.max(0, optionPrice);
            
            validOptions.push({
              name: optionName,
              price: finalPrice
            });
            
            console.log(`✅ CARDÁPIO DIGITAL - Opção ${i + 1} processada:`, { name: optionName, price: finalPrice });
          }

          if (validOptions.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Nenhuma opção válida encontrada para:', item.name);
            console.log('🔍 CARDÁPIO DIGITAL - Opções originais eram:', item.options);
            continue;
          }

          // Processar campos com valores padrão seguros
          const maxSelections = item.max_selections !== undefined && item.max_selections !== null 
            ? Math.max(1, Number(item.max_selections) || 1) 
            : 1;

          const processedVariation: ProductVariation = {
            id: String(item.id),
            name: String(item.name).trim(),
            required: Boolean(item.required),
            max_selections: maxSelections,
            options: validOptions
          };

          formatted.push(processedVariation);
          console.log('✅ CARDÁPIO DIGITAL - Variação processada com sucesso:', {
            name: processedVariation.name,
            opções: processedVariation.options.length,
            required: processedVariation.required,
            maxSelections: processedVariation.max_selections
          });
          
        } catch (itemError) {
          console.error('❌ CARDÁPIO DIGITAL - Erro ao processar variação:', itemError);
          console.error('❌ CARDÁPIO DIGITAL - Item que causou erro:', item);
          // Não parar o processamento por causa de uma variação com erro
        }
      }
      
      console.log('🎯 HOOK - RESULTADO FINAL:', {
        total: formatted.length,
        variações: formatted.map(v => ({ 
          name: v.name, 
          opções: v.options.length, 
          required: v.required,
          maxSelections: v.max_selections
        }))
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