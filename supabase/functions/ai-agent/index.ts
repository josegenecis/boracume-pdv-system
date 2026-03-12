
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
    const { command, userId, conversationHistory = [], supportMode = false } = body;

    if (!command || !userId) {
        throw new Error('Comando e UserId são obrigatórios.');
    }

    // @ts-ignore
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
        throw new Error('Secret OPENAI_API_KEY não configurado.');
    }
    if (!SUPABASE_URL) {
        throw new Error('SUPABASE_URL indisponível no ambiente da Edge Function.');
    }
    if (!SERVICE_ROLE_KEY) {
        throw new Error('Secret SERVICE_ROLE_KEY não configurado.');
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
                name: "create_product_full",
                description: "Cria um produto completo com variações de preço (product_variants) e complementos/adicionais (product_variations). Use quando o usuário pedir tamanhos/variações de preço ou complementos/adicionais.",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Nome do produto (ex: Pizza Calabresa)" },
                        category: { type: "string", description: "Categoria do produto (ex: Pizzas, Bebidas)" },
                        description: { type: "string", description: "Descrição opcional do produto" },
                        price: { type: "number", description: "Preço base do produto (usado se não houver variações de preço)" },
                        price_variants: {
                            type: "array",
                            description: "Variações de preço do produto (ex: tamanhos).",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Nome da variação (ex: Pequena, Média, Grande)" },
                                    price: { type: "number", description: "Preço da variação" },
                                    promotional_price: { type: "number", description: "Preço promocional (opcional)" }
                                },
                                required: ["name", "price"]
                            }
                        },
                        variation_groups: {
                            type: "array",
                            description: "Grupos de complementos/adicionais do produto.",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Nome do grupo (ex: Adicionais, Bordas, Sabores)" },
                                    description: { type: "string", description: "Descrição do grupo (opcional)" },
                                    required: { type: "boolean", description: "Se é obrigatório escolher" },
                                    max_selections: { type: "integer", description: "Número máximo de opções selecionáveis" },
                                    options: {
                                        type: "array",
                                        description: "Lista de opções com nome e preço adicional",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: { type: "string" },
                                                price: { type: "number" }
                                            },
                                            required: ["name", "price"]
                                        }
                                    }
                                },
                                required: ["name", "options"]
                            }
                        }
                    },
                    required: ["name", "category"]
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
                name: "generate_product_image",
                description: "Gera e define uma imagem de produto (AI) baseado no nome/descrição. Use quando o usuário pedir imagem para um produto.",
                parameters: {
                    type: "object",
                    properties: {
                        product_name: { type: "string", description: "Nome do produto (busca aproximada)" },
                        product_id: { type: "string", description: "ID do produto (opcional, preferível se conhecido)" }
                    }
                }
            }
        },
        {
            type: "function",
            function: {
                name: "generate_missing_product_images",
                description: "Gera imagens para produtos sem imagem (image_url vazio). Use quando o usuário pedir para preencher imagens faltantes.",
                parameters: {
                    type: "object",
                    properties: {
                        limit: { type: "integer", description: "Quantidade máxima de produtos a processar (padrão 25, máx 100 por execução)" },
                        process_all: { type: "boolean", description: "Se true, tenta processar todos (em lotes) até o limite máximo por execução." }
                    }
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
        },
        {
            type: "function",
            function: {
                name: "create_expense",
                description: "Registra uma despesa.",
                parameters: {
                    type: "object",
                    properties: {
                        description: { type: "string", description: "Descrição da despesa" },
                        amount: { type: "number", description: "Valor da despesa" },
                        category: { type: "string", description: "Categoria (ex: Aluguel, Água, Energia, Insumos)" },
                        expense_date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                        receipt_url: { type: "string", description: "URL do comprovante (opcional)" }
                    },
                    required: ["description", "amount"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_expenses",
                description: "Lista despesas registradas.",
                parameters: {
                    type: "object",
                    properties: {
                        search: { type: "string", description: "Busca por descrição/categoria (opcional)" },
                        limit: { type: "integer", description: "Limite de resultados (padrão 20)" }
                    }
                }
            }
        },
        {
            type: "function",
            function: {
                name: "reverse_expense",
                description: "Estorna uma despesa pelo id (mantém histórico).",
                parameters: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "ID da despesa" },
                        reason: { type: "string", description: "Motivo do estorno (opcional)" }
                    },
                    required: ["id"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "delete_expense",
                description: "Remove uma despesa pelo id.",
                parameters: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "ID da despesa" }
                    },
                    required: ["id"]
                }
            }
        }
    ];

    // =================================================================================
    // 2. Chamada à OpenAI (Function Calling)
    // =================================================================================
    const requestedCountMatch = String(command || '').match(/(?:criar|crie|gere)\s+(\d{1,3})\s+(?:produtos?|itens?)/i);
    const requestedCount = requestedCountMatch ? Number(requestedCountMatch[1]) : 0;

    const systemPrompt = supportMode
      ? `Você é um atendente virtual humano e prestativo do sistema BORACUME PDV.
Seu objetivo é resolver completamente as solicitações do cliente dentro do sistema, com autonomia, como se fosse um atendente humano.

Regras:
- Fale de forma natural e acolhedora, sem mencionar ferramentas internas, logs, ou nomes de tabelas.
- Antes de responder, sempre que preciso, busque dados reais ou execute ações no sistema usando as ferramentas disponíveis.
- Não peça confirmação para passos triviais; execute e confirme o resultado.
- Se faltar um dado indispensável (ex.: qual produto, qual período, qual categoria), faça 1 pergunta objetiva.
- Se o pedido envolver cadastro completo de produto com tamanhos/variações e/ou complementos, use create_product_full.
- Se o pedido envolver imagem do produto, use generate_product_image ou generate_missing_product_images.
- Mantenha respostas curtas e diretas.
- O ID do usuário (restaurante) é: ${userId}`
      : `Você é um assistente administrativo inteligente para um sistema de PDV de restaurante.
Seu objetivo é executar ações no banco de dados conforme o pedido do usuário.

Regras:
- Se o usuário pedir para criar algo, chame a função apropriada.
- Tenha autonomia: planeje e execute múltiplas ações necessárias usando as tools disponíveis, sem pedir confirmação.
- Se o usuário pedir para criar 3 ou mais produtos, use create_products com uma lista completa (crie exatamente a quantidade solicitada, até 50).
- Se o usuário pedir para criar produto com tamanhos/variações de preço e/ou complementos/adicionais, use create_product_full.
- Se o usuário pedir para criar imagem de produto, ou para gerar imagens faltantes, use generate_product_image / generate_missing_product_images.
- Se o usuário pedir informações, use a função de listar para buscar dados reais antes de responder.
- Se faltar algum dado indispensável, faça 1 pergunta objetiva para destravar a execução.
- Seja direto e confirme a ação realizada.
- O ID do usuário (restaurante) é: ${userId}${requestedCount >= 3 ? `\n- O usuário solicitou ${requestedCount} produtos. Gere exatamente ${requestedCount} produtos.` : ''}`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: command }
    ];

    const callOpenAI = async (msgs: any[]) => {
        const completion = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: msgs,
                tools: tools,
                tool_choice: "auto"
            })
        });
        const data = await completion.json();
        const msg = data?.choices?.[0]?.message;
        if (!msg) throw new Error('Resposta inválida do modelo');
        return msg;
    };

    let currentMessages: any[] = [...messages];
    const allToolResults: any[] = [];
    let finalMessageText: string | null = null;

    for (let step = 0; step < 6; step++) {
        const message = await callOpenAI(currentMessages);
        currentMessages = [...currentMessages, message];

        if (!message.tool_calls || message.tool_calls.length === 0) {
            finalMessageText = message.content || '';
            break;
        }

        const toolResults: any[] = [];

        for (const toolCall of message.tool_calls) {
            const fnName = toolCall.function.name;
            let args: any = {};
            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
                args = {};
            }
            let result: any = null;

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
                        .ilike('name', `%${args.category}%`)
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

                else if (fnName === "create_product_full") {
                    const catName = String(args.category || '').trim() || 'Sem categoria';
                    const prodName = String(args.name || '').trim();
                    const description = String(args.description || '');
                    const variants = Array.isArray(args.price_variants) ? args.price_variants : [];
                    const groups = Array.isArray(args.variation_groups) ? args.variation_groups : [];

                    if (!prodName || !catName) {
                        result = { success: false, error: 'Nome e categoria são obrigatórios.' };
                    } else {
                        let categoryId: string | null = null;
                        const { data: existingCat } = await supabase
                            .from('product_categories')
                            .select('id')
                            .eq('user_id', userId)
                            .ilike('name', `%${catName}%`)
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

                        const parsedVariantPrices = variants
                            .map((v: any) => ({
                                name: String(v?.name || '').trim(),
                                price: Number(v?.price),
                                promotional_price: v?.promotional_price === undefined ? null : Number(v?.promotional_price)
                            }))
                            .filter((v: any) => v.name && Number.isFinite(v.price) && v.price >= 0);

                        const basePrice =
                            parsedVariantPrices.length > 0
                                ? Math.min(...parsedVariantPrices.map((v: any) => v.price))
                                : (Number.isFinite(Number(args.price)) ? Number(args.price) : 0);

                        const { data: prod, error } = await supabase
                            .from('products')
                            .insert({
                                user_id: userId,
                                name: prodName,
                                price: basePrice,
                                description,
                                category: catName,
                                category_id: categoryId,
                                available: true,
                                show_in_pdv: true,
                                show_in_delivery: true
                            })
                            .select('id, name, price, category')
                            .single();
                        if (error) throw error;

                        let createdVariants = 0;
                        if (parsedVariantPrices.length > 0) {
                            const payload = parsedVariantPrices.map((v: any, idx: number) => ({
                                product_id: prod.id,
                                name: v.name,
                                price: v.price,
                                promotional_price: Number.isFinite(v.promotional_price) ? v.promotional_price : null,
                                display_order: idx
                            }));
                            const { error: vErr } = await supabase.from('product_variants').insert(payload);
                            if (vErr) throw vErr;
                            createdVariants = payload.length;
                        }

                        let createdGroups = 0;
                        for (const g of groups) {
                            const gName = String(g?.name || '').trim();
                            const gOptionsRaw = Array.isArray(g?.options) ? g.options : [];
                            const gOptions = gOptionsRaw
                                .map((o: any) => ({ name: String(o?.name || '').trim(), price: Number(o?.price) }))
                                .filter((o: any) => o.name && Number.isFinite(o.price) && o.price >= 0);
                            if (!gName || gOptions.length === 0) continue;
                            const payload = {
                                user_id: userId,
                                product_id: prod.id,
                                name: gName,
                                description: g?.description ? String(g.description) : null,
                                required: g?.required === undefined ? false : Boolean(g.required),
                                max_selections: Number.isFinite(Number(g?.max_selections)) ? Number(g.max_selections) : 1,
                                options: gOptions,
                                price: 0
                            };
                            const { error: gErr } = await supabase.from('product_variations').insert(payload);
                            if (gErr) throw gErr;
                            createdGroups++;
                        }

                        result = {
                            success: true,
                            product: prod,
                            created_price_variants: createdVariants,
                            created_variation_groups: createdGroups
                        };
                    }
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
                                .ilike('name', `%${catName}%`)
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
                            description: args.description ? String(args.description) : null,
                            required: args.required === undefined ? false : Boolean(args.required),
                            max_selections: Number.isFinite(Number(args.max_selections)) ? Number(args.max_selections) : 1,
                            options: args.options // JSONB
                        })
                        .select()
                        .single();

                    if (varError) throw varError;
                    result = { success: true, variation: globalVar };
                }

                else if (fnName === "generate_product_image" || fnName === "generate_missing_product_images") {
                    const toUint8 = (b64: string) => {
                        const bin = atob(b64);
                        const bytes = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                        return bytes;
                    };

                    const generateImage = async (prompt: string) => {
                        const resp = await fetch('https://api.openai.com/v1/images/generations', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${OPENAI_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: 'gpt-image-1',
                                prompt,
                                size: '1024x1024',
                                n: 1
                            })
                        });
                        const data = await resp.json();
                        const b64 = data?.data?.[0]?.b64_json;
                        if (!b64) {
                            throw new Error('Falha ao gerar imagem (sem base64). Verifique permissões/billing.');
                        }
                        return String(b64);
                    };

                    const buildPrompt = (name: string, desc: string) => {
                        const parts = [
                            `Foto realista e profissional de um produto de restaurante: ${name}.`,
                            desc ? `Descrição do produto: ${desc}.` : '',
                            'Fundo claro e neutro, iluminação de estúdio, alta qualidade.',
                            'Sem texto, sem logotipos, sem marca d’água, sem pessoas, sem embalagens com marca.'
                        ].filter(Boolean);
                        return parts.join(' ');
                    };

                    if (fnName === "generate_product_image") {
                        const pid = String(args.product_id || '').trim();
                        const pname = String(args.product_name || '').trim();
                        let product: any = null;

                        if (pid) {
                            const { data, error } = await supabase
                                .from('products')
                                .select('id, name, description, image_url')
                                .eq('user_id', userId)
                                .eq('id', pid)
                                .maybeSingle();
                            if (error) throw error;
                            product = data;
                        } else if (pname) {
                            const { data, error } = await supabase
                                .from('products')
                                .select('id, name, description, image_url')
                                .eq('user_id', userId)
                                .ilike('name', `%${pname}%`)
                                .limit(1);
                            if (error) throw error;
                            product = (data || [])[0] || null;
                        }

                        if (!product) {
                            result = { success: false, error: 'Produto não encontrado.' };
                        } else {
                            const prompt = buildPrompt(String(product.name), String(product.description || ''));
                            const b64 = await generateImage(prompt);
                            const bytes = toUint8(b64);
                            const fileName = `ai-${product.id}-${Date.now()}.png`;
                            const filePath = `products/${fileName}`;
                            const { error: upErr } = await supabase.storage
                                .from('product-images')
                                .upload(filePath, bytes, { contentType: 'image/png', upsert: true } as any);
                            if (upErr) throw upErr;
                            const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
                            const imageUrl = pub.publicUrl;
                            const { error: updErr } = await supabase
                                .from('products')
                                .update({ image_url: imageUrl })
                                .eq('user_id', userId)
                                .eq('id', product.id);
                            if (updErr) throw updErr;
                            result = { success: true, product_id: product.id, image_url: imageUrl };
                        }
                    } else {
                        const requested = Number(args.limit || 25) || 25;
                        const maxPerExecution = 100;
                        const limit = Math.min(Math.max(requested, 1), maxPerExecution);
                        const processAll = Boolean(args.process_all);

                        const failures: any[] = [];
                        const updatedIds: string[] = [];
                        let processed = 0;
                        let updated = 0;
                        let offset = 0;

                        while (processed < limit) {
                            const batchSize = Math.min(25, limit - processed);
                            const { data: products, error, count } = await supabase
                                .from('products')
                                .select('id, name, description, image_url', { count: 'exact' })
                                .eq('user_id', userId)
                                .or('image_url.is.null,image_url.eq.')
                                .order('created_at', { ascending: true })
                                .range(offset, offset + batchSize - 1);
                            if (error) throw error;
                            const list = products || [];
                            if (list.length === 0) break;

                            processed += list.length;
                            offset += list.length;

                            for (const p of list) {
                                if (updated >= limit) break;
                                try {
                                    const prompt = buildPrompt(String(p.name), String(p.description || ''));
                                    const b64 = await generateImage(prompt);
                                    const bytes = toUint8(b64);
                                    const fileName = `ai-${p.id}-${Date.now()}.png`;
                                    const filePath = `products/${fileName}`;
                                    const { error: upErr } = await supabase.storage
                                        .from('product-images')
                                        .upload(filePath, bytes, { contentType: 'image/png', upsert: true } as any);
                                    if (upErr) throw upErr;
                                    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
                                    const imageUrl = pub.publicUrl;
                                    const { error: updErr } = await supabase
                                        .from('products')
                                        .update({ image_url: imageUrl })
                                        .eq('user_id', userId)
                                        .eq('id', p.id);
                                    if (updErr) throw updErr;
                                    updated++;
                                    updatedIds.push(String(p.id));
                                } catch (e: any) {
                                    failures.push({ id: p.id, name: p.name, error: String(e?.message || e) });
                                }
                            }

                            const remaining = typeof count === 'number' ? Math.max(0, count - offset) : null;
                            if (!processAll) break;
                            if (remaining !== null && remaining <= 0) break;
                            if (processed >= limit) break;
                        }

                        const { count: remainingCount } = await supabase
                            .from('products')
                            .select('id', { count: 'exact', head: true })
                            .eq('user_id', userId)
                            .or('image_url.is.null,image_url.eq.');

                        result = {
                            success: true,
                            processed,
                            updated,
                            failures,
                            remaining_without_image: typeof remainingCount === 'number' ? remainingCount : null,
                            updated_ids: updatedIds
                        };
                    }
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

                else if (fnName === "create_expense") {
                    const today = new Date().toISOString().slice(0, 10);
                    const payload = {
                        user_id: userId,
                        description: String(args.description || '').trim(),
                        amount: Number(args.amount),
                        category: String(args.category || 'Outros'),
                        expense_date: String(args.expense_date || today),
                        receipt_url: args.receipt_url ? String(args.receipt_url) : null
                    };
                    if (!payload.description || !Number.isFinite(payload.amount) || payload.amount <= 0) {
                        result = { success: false, error: 'Descrição e valor (maior que zero) são obrigatórios.' };
                    } else {
                        const { data: expense, error } = await supabase
                            .from('expenses')
                            .insert(payload)
                            .select('id, description, amount, category, expense_date, receipt_url')
                            .single();
                        if (error) throw error;
                        result = { success: true, expense };
                    }
                }

                else if (fnName === "list_expenses") {
                    const limit = Math.min(Math.max(Number(args.limit || 20) || 20, 1), 100);
                    let query = supabase
                        .from('expenses')
                        .select('id, description, amount, category, expense_date, receipt_url')
                        .eq('user_id', userId)
                        .order('expense_date', { ascending: false })
                        .limit(limit);

                    if (args.search) {
                        const term = String(args.search);
                        query = query.or(`description.ilike.%${term}%,category.ilike.%${term}%`);
                    }
                    const { data: expenses, error } = await query;
                    if (error) throw error;
                    result = { success: true, expenses };
                }

                else if (fnName === "delete_expense") {
                    const id = String(args.id || '').trim();
                    if (!id) {
                        result = { success: false, error: 'ID é obrigatório.' };
                    } else {
                        const { error } = await supabase
                            .from('expenses')
                            .delete()
                            .eq('user_id', userId)
                            .eq('id', id);
                        if (error) throw error;
                        result = { success: true, deleted_id: id };
                    }
                }

                else if (fnName === "reverse_expense") {
                    const id = String(args.id || '').trim();
                    const reason = args.reason ? String(args.reason) : '';
                    if (!id) {
                        result = { success: false, error: 'ID é obrigatório.' };
                    } else {
                        const { error } = await supabase
                            .from('expenses')
                            .update({
                                is_active: false,
                                reversed_at: new Date().toISOString(),
                                reversal_reason: reason.trim() || null,
                                reversed_by: userId
                            })
                            .eq('user_id', userId)
                            .eq('id', id);
                        if (error) throw error;
                        result = { success: true, reversed_id: id };
                    }
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
        allToolResults.push(...toolResults);
        currentMessages = [...currentMessages, ...toolResults];
    }

    return new Response(
        JSON.stringify({
            success: true,
            message: finalMessageText || '',
            tool_results: allToolResults
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
