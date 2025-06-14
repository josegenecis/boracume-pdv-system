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
    setIsLoading(true);
    
    try {
      // Buscar variações específicas do produto
      const { data: productVariations } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      // Buscar variações globais associadas
      const { data: globalLinks } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      let globalVariations: any[] = [];
      if (globalLinks && globalLinks.length > 0) {
        const globalIds = globalLinks.map(link => link.global_variation_id);
        const { data: globals } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalIds);
        
        if (globals) globalVariations = globals;
      }

      // Combinar e formatar variações
      const allVariations = [...(productVariations || []), ...globalVariations];
      
      const formatted: ProductVariation[] = allVariations
        .filter(v => v && v.id && v.name && Array.isArray(v.options))
        .map(v => ({
          id: v.id,
          name: v.name,
          required: Boolean(v.required),
          max_selections: Math.max(1, Number(v.max_selections) || 1),
          options: (v.options || [])
            .filter((opt: any) => opt && opt.name)
            .map((opt: any) => ({
              name: String(opt.name),
              price: Number(opt.price) || 0
            }))
        }))
        .filter(v => v.options.length > 0);

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