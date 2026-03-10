
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function ai-agent V1 (Multi-Tool) iniciada!");

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { command, userId, conversationHistory = [] } = body;

    if (!command || !userId) {
        throw new Error('Comando e UserId são obrigatórios.');
    }

    // @ts-ignore
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Variáveis de ambiente (OPENAI/SUPABASE) não configuradas.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // =================================================================================
    // 1. Definição das TOOLS (Ferramentas que o Agente pode usar)
    // =================================================================================
    const tools = [
        {
            type: "function",
            function: {
                name: "create_product",
                description: "Cria um novo produto no cardápio.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Nome do produto (ex: X-Tudo)" },
                        price: { type: "number", description: "Preço do produto (ex: 25.00)" },
                        category: { type: "string", description: "Categoria do produto (ex: Lanches, Bebidas)" },
                        description: { type: "string", description: "Descrição opcional do produto" }
                    },
                    required: ["name", "price", "category"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "create_products",
                description: "Cria vários produtos no cardápio de uma vez. Use quando o usuário pedir para criar 3 ou mais produtos.",
                parameters: {
                    type: "object",
                    properties: {
                        products: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Nome do produto" },
                                    price: { type: "number", description: "Preço do produto" },
                                    category: { type: "string", description: "Categoria do produto" },
                                    description: { type: "string", description: "Descrição opcional do produto" }
                                },
                                required: ["name", "price", "category"]
                            },
                            description: "Lista de produtos a criar"
                        }
                    },
                    required: ["products"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "update_product_price",
                description: "Atualiza o preço de um produto existente.",
                parameters: {
                    type: "object",
                    properties: {
                        product_name: { type: "string", description: "Nome do produto a ser atualizado (busca aproximada)" },
                        new_price: { type: "number", description: "Novo preço do produto" }
                    },
                    required: ["product_name", "new_price"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "disable_product",
                description: "Desativa/Remove um produto do cardápio (disponibilidade = false).",
                parameters: {
                    type: "object",
                    properties: {
                        product_name: { type: "string", description: "Nome do produto a ser desativado" }
                    },
                    required: ["product_name"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "create_variation_group",
                description: "Cria um grupo de variações/adicionais para produtos.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Nome do grupo (ex: Adicionais, Tamanho)" },
                        options: { 
                            type: "array", 
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    price: { type: "number" }
                                }
                            },
                            description: "Lista de opções com nome e preço adicional"
                        },
                        required: { type: "boolean", description: "Se é obrigatório escolher uma opção" },
                        max_selections: { type: "integer", description: "Número máximo de opções selecionáveis" }
                    },
                    required: ["name", "options"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "add_delivery_zone",
                description: "Adiciona uma zona de entrega (bairro) com taxa.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Nome do bairro ou região" },
                        fee: { type: "number", description: "Taxa de entrega em R$" },
                        min_order: { type: "number", description: "Pedido mínimo em R$" },
                        delivery_time: { type: "string", description: "Tempo estimado (ex: 30-40 min)" }
                    },
                    required: ["name", "fee"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "add_courier",
                description: "Cadastra um novo entregador/motoboy.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Nome do entregador" },
                        phone: { type: "string", description: "Telefone do entregador" },
                        vehicle: { type: "string", description: "Veículo (ex: Moto Honda 123)" }
                    },
                    required: ["name", "phone"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_products",
                description: "Lista produtos do cardápio para consulta. Use quando o usuário perguntar 'quais produtos temos' ou 'preço do X'.",
                parameters: {
                    type: "object",
                    properties: {
                        search: { type: "string", description: "Termo de busca opcional" }
                    }
                }
            }
        }
    ];

    // =================================================================================
    // 2. Chamada à OpenAI (Function Calling)
    // =================================================================================
    const requestedCountMatch = String(command || '').match(/(?:criar|crie|gere)\s+(\d{1,3})\s+(?:produtos?|itens?)/i);
    const requestedCount = requestedCountMatch ? Number(requestedCountMatch[1]) : 0;

    const systemPrompt = `Você é um assistente administrativo inteligente para um sistema de PDV de restaurante.
    Seu objetivo é executar ações no banco de dados conforme o pedido do usuário.
    
    Regras:
    - Se o usuário pedir para criar algo, chame a função apropriada.
    - Se o usuário pedir para criar 3 ou mais produtos, use create_products com uma lista completa (crie exatamente a quantidade solicitada, até 50).
    - Se o usuário pedir informações, use a função de listar para buscar dados reais antes de responder.
    - Seja direto e confirme a ação realizada.
    - O ID do usuário (restaurante) é: ${userId}${requestedCount >= 3 ? `\n- O usuário solicitou ${requestedCount} produtos. Gere exatamente ${requestedCount} produtos.` : ''}`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: command }
    ];

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // Modelo rápido e capaz de function calling
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        })
    });

    const completionData = await completion.json();
    const message = completionData.choices[0].message;

    // =================================================================================
    // 3. Execução das Tools (se houver chamada)
    // =================================================================================
    if (message.tool_calls) {
        const toolResults = [];

        for (const toolCall of message.tool_calls) {
            const fnName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            let result = null;

            console.log(`[Agent] Executing tool: ${fnName}`, args);

            try {
                // --- CREATE PRODUCT ---
                if (fnName === "create_product") {
                    // 1. Find or create category
                    let categoryId = null;
                    const { data: existingCat } = await supabase
                        .from('product_categories')
                        .select('id')
                        .eq('user_id', userId)
                        .ilike('name', args.category)
                        .maybeSingle();
                    
                    if (existingCat) {
                        categoryId = existingCat.id;
                    } else {
                        const { data: newCat } = await supabase
                            .from('product_categories')
                            .insert({ user_id: userId, name: args.category })
                            .select('id')
                            .single();
                        if (newCat) categoryId = newCat.id;
                    }

                    // 2. Create product
                    const { data: prod, error } = await supabase
                        .from('products')
                        .insert({
                            user_id: userId,
                            name: args.name,
                            price: args.price,
                            description: args.description || '',
                            category: args.category,
                            category_id: categoryId,
                            available: true,
                            show_in_pdv: true,
                            show_in_delivery: true
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    result = { success: true, product: prod };
                }

                // --- CREATE PRODUCTS (BATCH) ---
                else if (fnName === "create_products") {
                    const products = Array.isArray(args.products) ? args.products : [];
                    const max = 50;
                    const toCreate = products.slice(0, max);
                    const categoryCache = new Map<string, string>();
                    const createdNames: string[] = [];

                    for (const p of toCreate) {
                        const catName = String(p.category || '').trim() || 'Sem categoria';
                        let categoryId = categoryCache.get(catName) || null;

                        if (!categoryId) {
                            const { data: existingCat } = await supabase
                                .from('product_categories')
                                .select('id, name')
                                .eq('user_id', userId)
                                .ilike('name', catName)
                                .maybeSingle();

                            if (existingCat) {
                                categoryId = existingCat.id;
                            } else {
                                const { data: newCat } = await supabase
                                    .from('product_categories')
                                    .insert({ user_id: userId, name: catName })
                                    .select('id')
                                    .single();
                                if (newCat) categoryId = newCat.id;
                            }

                            if (categoryId) categoryCache.set(catName, categoryId);
                        }

                        const name = String(p.name || '').trim();
                        const price = Number(p.price);
                        if (!name || !Number.isFinite(price)) continue;

                        const { error } = await supabase
                            .from('products')
                            .insert({
                                user_id: userId,
                                name,
                                price,
                                description: String(p.description || ''),
                                category: catName,
                                category_id: categoryId,
                                available: true,
                                show_in_pdv: true,
                                show_in_delivery: true
                            });
                        if (error) throw error;
                        createdNames.push(name);
                    }

                    result = { success: true, created_count: createdNames.length, created_names: createdNames };
                }

                // --- UPDATE PRICE ---
                else if (fnName === "update_product_price") {
                    // Find product first
                    const { data: products } = await supabase
                        .from('products')
                        .select('id, name')
                        .eq('user_id', userId)
                        .ilike('name', `%${args.product_name}%`)
                        .limit(1);
                    
                    if (!products || products.length === 0) {
                        result = { success: false, error: "Produto não encontrado." };
                    } else {
                        const { error } = await supabase
                            .from('products')
                            .update({ price: args.new_price })
                            .eq('id', products[0].id);
                        
                        if (error) throw error;
                        result = { success: true, updated: products[0].name, new_price: args.new_price };
                    }
                }

                // --- DISABLE PRODUCT ---
                else if (fnName === "disable_product") {
                    const { data: products } = await supabase
                        .from('products')
                        .select('id, name')
                        .eq('user_id', userId)
                        .ilike('name', `%${args.product_name}%`)
                        .limit(1);
                    
                    if (!products || products.length === 0) {
                        result = { success: false, error: "Produto não encontrado." };
                    } else {
                        const { error } = await supabase
                            .from('products')
                            .update({ available: false })
                            .eq('id', products[0].id);
                        
                        if (error) throw error;
                        result = { success: true, disabled: products[0].name };
                    }
                }

                // --- CREATE VARIATION GROUP ---
                else if (fnName === "create_variation_group") {
                    // 1. Create global variation
                    const { data: globalVar, error: varError } = await supabase
                        .from('global_variations')
                        .insert({
                            user_id: userId,
                            name: args.name,
                            min_selections: args.required ? 1 : 0,
                            max_selections: args.max_selections || 1,
                            options: args.options // JSONB
                        })
                        .select()
                        .single();

                    if (varError) throw varError;
                    result = { success: true, variation: globalVar };
                }

                // --- ADD DELIVERY ZONE ---
                else if (fnName === "add_delivery_zone") {
                    const { data: zone, error } = await supabase
                        .from('delivery_zones')
                        .insert({
                            user_id: userId,
                            name: args.name,
                            delivery_fee: args.fee,
                            minimum_order: args.min_order || 0,
                            delivery_time: args.delivery_time || '30-45 min',
                            active: true
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    result = { success: true, zone: zone };
                }

                // --- ADD COURIER ---
                else if (fnName === "add_courier") {
                    const { data: courier, error } = await supabase
                        .from('couriers')
                        .insert({
                            user_id: userId,
                            name: args.name,
                            phone: args.phone,
                            vehicle_info: args.vehicle,
                            active: true
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    result = { success: true, courier: courier };
                }

                // --- LIST PRODUCTS ---
                else if (fnName === "list_products") {
                    let query = supabase
                        .from('products')
                        .select('name, price, category, available')
                        .eq('user_id', userId)
                        .limit(20);
                    
                    if (args.search) {
                        query = query.ilike('name', `%${args.search}%`);
                    }
                    
                    const { data: products, error } = await query;
                    if (error) throw error;
                    result = { success: true, products: products };
                }

            } catch (err: any) {
                console.error(`Error executing ${fnName}:`, err);
                result = { success: false, error: err.message };
            }

            toolResults.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: fnName,
                content: JSON.stringify(result)
            });
        }

        // =================================================================================
        // 4. Chamada Final à OpenAI (com os resultados das tools)
        // =================================================================================
        const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    ...messages,
                    message, // A resposta original com tool_calls
                    ...toolResults // Os resultados das tools
                ]
            })
        });

        const finalData = await finalResponse.json();
        const finalMessage = finalData.choices[0].message.content;

        return new Response(
            JSON.stringify({ 
                success: true, 
                message: finalMessage,
                tool_results: toolResults 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    // Se não houve tool call, retorna a resposta direta (conversação)
    return new Response(
        JSON.stringify({ 
            success: true, 
            message: message.content 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[AI Agent] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
