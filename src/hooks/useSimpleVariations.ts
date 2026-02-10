
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { invokeEdgeFunction } from "@/utils/invokeEdgeFunction";

export function useSimpleVariations() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchVariations = async (productId: string): Promise<any[]> => {
    console.log('🔄 CARDÁPIO DIGITAL - Iniciando busca de variações para produto:', productId);
    console.log('🔍 CARDÁPIO DIGITAL - URL atual:', window.location.href);
    console.log('🔍 CARDÁPIO DIGITAL - Produto ID tipo:', typeof productId, 'valor:', productId);
    setIsLoading(true);
    
    try {
      // Buscar variações específicas do produto
      console.log('📡 CARDÁPIO DIGITAL - Executando query variações específicas...');

      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);


      if (productError) {
        console.error('❌ CARDÁPIO DIGITAL - Erro ao carregar variações específicas:', productError);
        throw productError
      } else {
        console.log('📋 CARDÁPIO DIGITAL - Variações específicas encontradas:', productVariations?.length || 0, productVariations);
      }

      // Buscar variações globais associadas ao produto
      console.log('🔍 CARDÁPIO DIGITAL - Buscando links de variações globais...');
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id, required, min_selections, max_selections')
        .eq('product_id', productId) as any;

      if (globalError) {
        console.error('❌ CARDÁPIO DIGITAL - Erro ao carregar links de variações globais:', globalError);
        throw globalError
      } else {
        console.log('🔗 CARDÁPIO DIGITAL - Links de variações globais encontrados:', globalVariationLinks?.length || 0, globalVariationLinks);
      }

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      const linksArr: any[] = Array.isArray(globalVariationLinks) ? globalVariationLinks as any[] : [];
      if (linksArr.length > 0) {
        const globalVariationIds = linksArr.map((link: any) => link.global_variation_id);
        console.log('🆔 CARDÁPIO DIGITAL - IDs das variações globais a buscar:', globalVariationIds);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds as any) as any;

        if (globalVarError) {
          console.error('❌ CARDÁPIO DIGITAL - Erro ao buscar variações globais:', globalVarError);
          throw globalVarError
        } else if (globalVars) {
          console.log('🌐 CARDÁPIO DIGITAL - Variações globais encontradas:', globalVars.length, globalVars);
          
          // Mesclar configurações do vínculo nas variações globais
          const globalsArr: any[] = Array.isArray(globalVars) ? globalVars as any[] : [];
          globalVariations = globalsArr.map((globalVar: any) => {
            const link = linksArr.find((l: any) => l.global_variation_id === globalVar.id);
            const mergedVariation = {
              ...globalVar,
              required: link?.required ?? false,
              min_selections: link?.min_selections ?? 0,
              max_selections: link?.max_selections ?? 1
            };
            console.log('🔧 CARDÁPIO DIGITAL - Variação global mesclada:', mergedVariation);
            return mergedVariation;
          });
        }
      } else {
        console.log('⚠️ CARDÁPIO DIGITAL - Nenhum link de variação global encontrado para o produto');
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];
      
      console.log('📊 CARDÁPIO DIGITAL - Total de variações combinadas:', allVariations.length, allVariations);

      if (allVariations.length === 0) {
        console.log('⚠️ CARDÁPIO DIGITAL - NENHUMA VARIAÇÃO ENCONTRADA!');
        console.log('⚠️ CARDÁPIO DIGITAL - Verificações:');
        console.log('  ✓ Query executou sem erro');
        console.log('  ✓ ProductId:', productId);
        console.log('  ? Produto tem variações cadastradas na tabela product_variations?');
        console.log('  ? Produto tem variações globais vinculadas?');
        console.log('  ? User_id está correto nas variações?');
        return [];
      }

      const formatted: any[] = [];

      for (const item of allVariations as any[]) {
        console.log('🔄 CARDÁPIO DIGITAL - Processando variação:', item.name);
        console.log('🔍 CARDÁPIO DIGITAL - Dados brutos da variação:', JSON.stringify(item, null, 2));
        
        try {


          if (!item || !item.id) {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem ID:', item);
            continue;
          }


          if (!item.name || String(item.name).trim() === '') {
            console.log('⚠️ CARDÁPIO DIGITAL - Variação sem nome:', item);
            continue;
          }


          console.log('🔍 CARDÁPIO DIGITAL - Verificando opções para:', item.name, 'Opções:', item.options);

          let processedOptions = [];
          
          if (!item.options) {
            console.log('⚠️ CARDÁPIO DIGITAL - Propriedade options não existe para:', item.name);
            continue;
          }



          if (typeof item.options === 'string') {
            console.log('🔄 CARDÁPIO DIGITAL - Options é string, tentando converter:', item.options);
            try {
              processedOptions = JSON.parse(item.options);
              console.log('✅ CARDÁPIO DIGITAL - Conversão de string bem sucedida:', processedOptions);
            } catch (parseError) {
              console.log('❌ CARDÁPIO DIGITAL - Erro ao converter string JSON. Tentando sanitizar...');
              try {
                const sanitized = String(item.options)
                  .replace(/\s+/g, ' ')
                  .replace(/'/g, '"')
                  .replace(/,\s*]/g, ']')
                  .trim();
                processedOptions = JSON.parse(sanitized);
                console.log('✅ CARDÁPIO DIGITAL - Conversão após sanitização bem sucedida:', processedOptions);
              } catch (sanError) {
                console.log('❌ CARDÁPIO DIGITAL - Falha na sanitização. Aplicando fallback por vírgulas.');
                const names = String(item.options).split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
                processedOptions = names.map((name: string) => ({ name, price: 0 }));
                console.log('✅ CARDÁPIO DIGITAL - Fallback por vírgulas aplicado:', processedOptions);
              }
            }
          } else if (Array.isArray(item.options)) {
            processedOptions = item.options;
          } else if (typeof item.options === 'object' && item.options !== null) {
            // Suportar formato { "Bacon": 2.5, "Queijo": 1 }
            processedOptions = Object.entries(item.options).map(([name, price]) => ({
              name,
              price: Number(price) || 0
            }));
          } else {
            console.log('⚠️ CARDÁPIO DIGITAL - Options em formato desconhecido:', typeof item.options, item.options);
            continue;
          }

          if (processedOptions.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Array de options vazio para:', item.name);
            continue;
          }


          const validOptions: any[] = [];

          for (let i = 0; i < processedOptions.length; i++) {
            const opt = processedOptions[i] as any;
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

            const finalPrice = isNaN(optionPrice) ? 0 : Math.max(0, optionPrice);


            validOptions.push({
              name: optionName,
              price: finalPrice
            });


            console.log(`✅ CARDÁPIO DIGITAL - Opção ${i + 1} processada:`, { name: optionName, price: finalPrice });
          }

          if (validOptions.length === 0) {
            console.log('⚠️ CARDÁPIO DIGITAL - Nenhuma opção válida encontrada para:', item.name);
            console.log('🔍 CARDÁPIO DIGITAL - Opções originais eram:', processedOptions);
            continue;
          }



          const maxSelections = item.max_selections !== undefined && item.max_selections !== null 
            ? Math.max(1, Number(item.max_selections) || 1) 
            : 1;

          const processedVariation: any = {
            id: String(item.id),
            name: String(item.name).trim(),
            required: Boolean(item.required ?? item.is_required ?? false),
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
        }
      }

      console.log('🎯 CARDÁPIO DIGITAL - RESULTADO FINAL:', {

        total: formatted.length,
        variações: formatted.map(v => ({ 
          name: v.name, 
          opções: v.options.length, 
          required: v.required,
          maxSelections: v.max_selections
        }))
      });

      
      return formatted as any[];
    } catch (error) {
      console.error('💥 CARDÁPIO DIGITAL - Erro geral ao carregar variações:', error);
      try {
        const { data: j } = await invokeEdgeFunction<any>('product-variations-public', { productId })
        if (j?.ok && Array.isArray(j.variations)) {
          const variations = j.variations.map((item: any) => ({
            id: String(item.id),
            name: String(item.name || ''),
            required: Boolean(item.required ?? false),
            max_selections: Math.max(1, Number(item.max_selections ?? 1)),
            options: (() => {
              const raw = item.options
              if (!raw) return []
              if (typeof raw === 'string') {
                try { return JSON.parse(raw) } catch { return String(raw).split(/[,;\n]/).map((name: string) => ({ name: name.trim(), price: 0 })) }
              }
              if (Array.isArray(raw)) return raw
              if (typeof raw === 'object') return Object.entries(raw).map(([name, price]) => ({ name, price: Number(price) || 0 }))
              return []
            })()
          }))
          return variations as any[]
        }
      } catch (e) {
        console.warn('Fallback público de variações falhou', e)
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const calculateVariationPrice = (selectedVariations: Record<string, string[]>, variations: any[]) => {
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

    // Remover duplicatas
    return Array.from(new Set(texts));

  };

  return { isLoading, fetchVariations, calculateVariationPrice, getSelectedVariationsText };
}
