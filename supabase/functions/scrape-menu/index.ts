
// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function scrape-menu V6 (Senior Node Fix) iniciada!");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text();
    if (!bodyText) throw new Error('Body vazio');
    
    let body;
    try {
        body = JSON.parse(bodyText);
    } catch (e) {
        throw new Error('JSON inválido no body');
    }

    const { type, data } = body;
    console.log(`[ScrapeMenu] Requisição recebida. Tipo: ${type}`);

    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (type === 'image' && !OPENAI_API_KEY) {
         throw new Error('Configuração de IA (OPENAI_API_KEY) ausente no servidor.');
    }

    // --- CASO 1: URL ---
    if (type === 'url') {
        
        // A. Tentar APIFY (iFood)
        if (APIFY_TOKEN && data.includes('ifood.com.br')) {
            try {
                console.log('[ScrapeMenu] Detectado iFood. Tentando extrair ID da loja...');
                
                // Tenta extrair o UUID da URL do iFood
                const ifoodIdMatch = data.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
                const storeId = ifoodIdMatch ? ifoodIdMatch[1] : null;

                if (storeId) {
                    console.log(`[ScrapeMenu] ID da loja encontrado: ${storeId}. Usando Actor priscilas/ifood-menu-scraper...`);
                    
                    const runUrl = `https://api.apify.com/v2/acts/priscilas~ifood-menu-scraper/runs?token=${APIFY_TOKEN}`;
                    
                    const startResp = await fetch(runUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            "store_ids": [storeId],
                            "proxyConfiguration": { "useApifyProxy": true }
                        })
                    });

                    if (!startResp.ok) {
                        const err = await startResp.text();
                        throw new Error(`Apify iFood Actor Failed: ${startResp.status} - ${err}`);
                    }

                    const startData = await startResp.json();
                    const runId = startData.data.id;
                    const datasetId = startData.data.defaultDatasetId;
                    console.log('[ScrapeMenu] Run ID:', runId);

                    // Polling
                    let status = 'RUNNING';
                    const startTime = Date.now();
                    while (status === 'RUNNING' || status === 'READY') {
                        if (Date.now() - startTime > 110000) break; 
                        await new Promise(r => setTimeout(r, 5000));
                        const checkResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                        const checkData = await checkResp.json();
                        status = checkData.data.status;
                    }

                    if (status === 'SUCCEEDED') {
                        const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
                        const items = await itemsResp.json();
                        
                        if (items && items.length > 0) {
                            console.log(`[ScrapeMenu] iFood retornou ${items.length} itens no dataset.`);
                            
                            // LOG CRÍTICO PARA DEBUG: Inspecionar o PRIMEIRO item
                            console.log('[DEBUG] Primeiro item do dataset:', JSON.stringify(items[0], null, 2));

                            // Lógica de Extração Robusta
                            // O Actor pode retornar uma lista de produtos plana OU um objeto de loja contendo o menu
                            let menuItems: any[] = [];

                            if (items[0].menu && Array.isArray(items[0].menu)) {
                                // Caso 1: Estrutura aninhada { restaurant: "...", menu: [...] }
                                console.log('[ScrapeMenu] Detectada estrutura aninhada (menu). Extraindo...');
                                menuItems = items[0].menu;
                            } else if (items[0].categories && Array.isArray(items[0].categories)) {
                                // Caso 2: Estrutura por categorias { restaurant: "...", categories: [...] }
                                console.log('[ScrapeMenu] Detectada estrutura de categorias. Extraindo...');
                                // Flatten categories
                                for (const cat of items[0].categories) {
                                    if (cat.items && Array.isArray(cat.items)) {
                                        menuItems.push(...cat.items.map((i: any) => ({ ...i, category: cat.name })));
                                    }
                                }
                            } else {
                                // Caso 3: Lista plana de produtos (o dataset É os itens)
                                console.log('[ScrapeMenu] Assumindo lista plana de produtos.');
                                menuItems = items;
                            }

                            if (menuItems.length > 0) {
                                console.log(`[ScrapeMenu] Total de produtos extraídos: ${menuItems.length}. Tentando mapeamento...`);
                                
                                // TENTATIVA 1: Mapeamento Direto
                                const mappedCategories = mapApifyItemsToCategories(menuItems);
                                if (mappedCategories.length > 0) {
                                    console.log('[ScrapeMenu] Mapeamento direto bem sucedido!');
                                    return new Response(
                                        JSON.stringify({ success: true, categories: mappedCategories }),
                                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                                    );
                                }
                                
                                // TENTATIVA 2: IA (com os dados extraídos corretamente)
                                console.log('[ScrapeMenu] Mapeamento falhou. Enviando amostra para IA...');
                                const jsonContent = JSON.stringify(menuItems.slice(0, 50)); 
                                return await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
                            } else {
                                throw new Error('Não foi possível encontrar array de produtos no retorno do Apify.');
                            }
                        } else {
                            console.warn('[ScrapeMenu] Dataset vazio.');
                        }
                    } else {
                        console.warn(`[ScrapeMenu] iFood Actor não terminou com sucesso (${status}).`);
                    }
                } else {
                    console.warn('[ScrapeMenu] ID da loja não encontrado na URL.');
                }
            } catch (e: any) {
                console.warn('[ScrapeMenu] Erro no fluxo iFood:', e.message);
            }
        }

        // B. Tentar APIFY Genérico (Fallback)
        if (APIFY_TOKEN) {
             try {
                console.log('[ScrapeMenu] Usando Apify Crawler Genérico...');
                const runUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=${APIFY_TOKEN}`;
                const startResp = await fetch(runUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startUrls: [{ url: data }],
                        maxCrawlPages: 1,
                        proxyConfiguration: { useApifyProxy: true },
                        browser: 'chromium',
                        renderingTypeDetectionRatio: 0.1
                    })
                });

                if (startResp.ok) {
                    const startData = await startResp.json();
                    const runId = startData.data.id;
                    const datasetId = startData.data.defaultDatasetId;
                    
                    let status = 'RUNNING';
                    const startTime = Date.now();
                    while (status === 'RUNNING' || status === 'READY') {
                        if (Date.now() - startTime > 60000) break;
                        await new Promise(r => setTimeout(r, 3000));
                        const checkResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                        const checkData = await checkResp.json();
                        status = checkData.data.status;
                    }

                    if (status === 'SUCCEEDED') {
                        const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
                        const items = await itemsResp.json();
                        if (items && items.length > 0) {
                            const textContent = items[0].text || items[0].markdown || JSON.stringify(items);
                            return await processWithAI(textContent, OPENAI_API_KEY);
                        }
                    }
                }
             } catch (e) {
                 console.warn('[ScrapeMenu] Apify Genérico falhou:', e);
             }
        }

        // C. Tentar Browserless/Puppeteer (Fallback)
        if (BROWSERLESS_API_KEY) {
             try {
                const blResp = await fetch(`https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}&stealth=true`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: data,
                        waitFor: 'networkidle2',
                        rejectResourceTypes: ['image', 'font', 'media']
                    })
                });
                if (blResp.ok) {
                    const text = await blResp.text();
                    return await processWithAI(text, OPENAI_API_KEY);
                }
             } catch (e) {
                 console.warn('[ScrapeMenu] Browserless falhou:', e);
             }
        }

        // D. Tentar Jina.ai (Fallback final)
        try {
            const jinaResp = await fetch(`https://r.jina.ai/${data}`);
            if (jinaResp.ok) {
                const text = await jinaResp.text();
                return await processWithAI(text, OPENAI_API_KEY);
            }
        } catch (e) {
            console.warn('[ScrapeMenu] Jina falhou:', e);
        }

        throw new Error('Não foi possível ler o site. Tente tirar um PRINT do cardápio e usar a opção "Imagem".');
    }

    // --- CASO 2: IMAGEM ---
    if (type === 'image') {
        return await processWithAI(data, OPENAI_API_KEY, true);
    }

    throw new Error('Tipo de importação inválido');

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro Fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
})

// === HELPERS ===

function mapApifyItemsToCategories(items: any[]): any[] {
    const categoriesMap: Record<string, any[]> = {};
    
    for (const item of items) {
        // Normalização de campos
        // Tenta encontrar campos em vários níveis
        const name = item.name || item.title || item.productName || item.item_name;
        const price = parseFloat(item.price || item.unitPrice || item.value || item.basePrice || '0');
        const categoryName = item.category || item.menuSection || item.group || item.category_name || 'Geral';
        const description = item.description || item.details || item.shortDescription || '';
        const imageUrl = item.imageUrl || item.image || item.image_url || '';
        
        if (!name) continue;

        // Processar Variações/Opções
        const variants: any[] = [];
        
        // Estrutura comum: options, choices, modifiers, garnishes
        const optionsSource = item.options || item.choices || item.modifiers || item.garnishes || [];
        
        if (Array.isArray(optionsSource)) {
            for (const opt of optionsSource) {
                // Se for um grupo de opções (ex: "Escolha o tamanho")
                if (opt.options && Array.isArray(opt.options)) {
                    for (const subOpt of opt.options) {
                        if (subOpt.name) {
                            variants.push({ 
                                name: subOpt.name, 
                                price: parseFloat(subOpt.price || subOpt.value || '0') 
                            });
                        }
                    }
                } 
                // Se for uma opção direta
                else if (opt.name) {
                    variants.push({ 
                        name: opt.name, 
                        price: parseFloat(opt.price || opt.value || '0') 
                    });
                }
            }
        }

        if (!categoriesMap[categoryName]) {
            categoriesMap[categoryName] = [];
        }

        categoriesMap[categoryName].push({
            name,
            price,
            description,
            image_url: imageUrl,
            variants
        });
    }

    return Object.entries(categoriesMap).map(([name, items]) => ({
        name,
        items
    }));
}

async function processWithAI(content: string, apiKey: string | undefined, isImage = false, isJson = false) {
    if (!apiKey) throw new Error('Chave OpenAI não configurada.');

    const systemPrompt = `Você é um especialista em estruturar cardápios.
    Extraia produtos, preços e VARIAÇÕES (tamanhos, sabores, adicionais) do JSON ou texto.
    
    SAÍDA JSON:
    {
      "categories": [
        {
          "name": "Nome Categoria",
          "items": [ 
            { 
              "name": "Produto", 
              "price": 0.00, 
              "description": "...", 
              "variants": [ { "name": "Grande", "price": 10.00 } ] 
            } 
          ]
        }
      ]
    }
    Se receber um JSON estruturado, preserve ao máximo a estrutura original.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { 
            role: 'user', 
            content: isImage 
                ? [
                    { type: "text", text: "Extraia o cardápio desta imagem." },
                    { type: "image_url", image_url: { url: content, detail: "high" } }
                  ]
                : `Extraia o cardápio:\n\n${content.slice(0, 50000)}`
        }
    ];

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        })
    });

    if (!aiResp.ok) {
        const err = await aiResp.text();
        throw new Error(`Erro IA: ${err}`);
    }

    const aiData = await aiResp.json();
    const rawContent = aiData.choices[0].message.content;
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return new Response(
        JSON.stringify({ success: true, categories: parsed.categories || parsed.menu || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
}
