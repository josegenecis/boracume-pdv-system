
// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function scrape-menu V10 (Status Failed Fix) iniciada!");

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

    const { type, data, action = 'start', runId } = body;
    console.log(`[ScrapeMenu] Action: ${action}, Type: ${type}, RunID: ${runId}`);

    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // =================================================================================
    // ROTA 1: START
    // =================================================================================
    if (action === 'start') {
        if (type === 'url') {
             // 1. iFood Logic
             if (APIFY_TOKEN && data.includes('ifood.com.br')) {
                const ifoodIdMatch = data.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
                const storeId = ifoodIdMatch ? ifoodIdMatch[1] : null;

                if (storeId) {
                    console.log(`[Start] Iniciando Apify iFood Async para loja: ${storeId}`);
                    
                    const runUrl = `https://api.apify.com/v2/acts/priscilas~ifood-menu-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=0`;
                    
                    const inputPayload = {
                        "store_ids": [storeId],
                        "proxyConfiguration": { "useApifyProxy": true },
                        "latitude": "-23.550520",
                        "longitude": "-46.633308"
                    };
                    
                    console.log("[Start] Payload enviado para Apify:", JSON.stringify(inputPayload));

                    const startResp = await fetch(runUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(inputPayload)
                    });

                    if (!startResp.ok) {
                        const errText = await startResp.text();
                        console.error(`[Start] Erro Apify: ${startResp.status} - ${errText}`);
                        throw new Error(`Erro ao iniciar Apify: ${startResp.status} - ${errText}`);
                    }
                    
                    const startData = await startResp.json();
                    return new Response(
                        JSON.stringify({ success: true, runId: startData.data.id, status: 'started' }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                    );
                }
             }

             // 2. Generic Crawler Logic
             if (APIFY_TOKEN) {
                console.log(`[Start] Iniciando Apify Generic Async...`);
                
                const runUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=${APIFY_TOKEN}&waitForFinish=0`;
                
                const inputPayload = {
                    startUrls: [{ url: data }],
                    maxCrawlPages: 1,
                    proxyConfiguration: { useApifyProxy: true }
                };

                console.log("[Start] Payload enviado para Apify Generic:", JSON.stringify(inputPayload));

                const startResp = await fetch(runUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputPayload)
                });

                if (!startResp.ok) {
                    const errText = await startResp.text();
                    console.error(`[Start] Erro Apify Generic: ${startResp.status} - ${errText}`);
                    throw new Error(`Erro ao iniciar Apify Generic: ${startResp.status}`);
                }
                
                const startData = await startResp.json();
                return new Response(
                    JSON.stringify({ success: true, runId: startData.data.id, status: 'started' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
             }
        }
        
        if (type === 'image') {
             const result = await processWithAI(data, OPENAI_API_KEY, true);
             return result;
        }
    }

    // =================================================================================
    // ROTA 2: CHECK
    // =================================================================================
    if (action === 'check') {
        if (!runId) throw new Error('RunId obrigatório para check.');

        const checkResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        const checkData = await checkResp.json();
        const status = checkData.data.status;

        console.log(`[Check] Status atual: ${status}`);

        if (status === 'RUNNING' || status === 'READY') {
            return new Response(
                JSON.stringify({ success: true, status: 'processing' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        if (status === 'SUCCEEDED') {
            const datasetId = checkData.data.defaultDatasetId;
            console.log(`[Check] Sucesso! Baixando dataset: ${datasetId}`);
            
            const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            const items = await itemsResp.json();

            if (!items || items.length === 0) {
                // CORREÇÃO: status: 'failed' para parar o polling
                return new Response(
                    JSON.stringify({ success: false, status: 'failed', error: 'Dataset vazio. O scraper não encontrou itens.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }

            // Lógica de extração (igual à V6)
            let menuItems: any[] = [];
            
            if (items[0].menu && Array.isArray(items[0].menu)) {
                menuItems = items[0].menu;
            } else if (items[0].categories && Array.isArray(items[0].categories)) {
                for (const cat of items[0].categories) {
                    if (cat.items && Array.isArray(cat.items)) {
                        menuItems.push(...cat.items.map((i: any) => ({ ...i, category: cat.name })));
                    }
                }
            } else {
                menuItems = items;
            }

            if (menuItems.length > 0) {
                 const mappedCategories = mapApifyItemsToCategories(menuItems);
                 if (mappedCategories.length > 0) {
                      return new Response(
                        JSON.stringify({ success: true, status: 'completed', categories: mappedCategories }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                    );
                 }
                 // IA Fallback
                 console.log('[Check] Mapeamento falhou, usando IA...');
                 const jsonContent = JSON.stringify(menuItems.slice(0, 60)); 
                 return await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
            }
             
            // CORREÇÃO: status: 'failed'
            return new Response(
                JSON.stringify({ success: false, status: 'failed', error: 'Não foi possível extrair produtos do dataset.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        // Se falhou ou abortou
        return new Response(
            JSON.stringify({ success: false, status: 'failed', error: `Apify terminou com status: ${status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    throw new Error('Ação inválida ou tipo não suportado.');

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro Fatal:', error);
    // CORREÇÃO: status: 'failed' no catch global
    return new Response(
      JSON.stringify({ success: false, status: 'failed', error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
})

// === HELPERS (Mantidos) ===
function mapApifyItemsToCategories(items: any[]): any[] {
    const categoriesMap: Record<string, any[]> = {};
    for (const item of items) {
        const name = item.name || item.title || item.productName || item.item_name;
        const price = parseFloat(item.price || item.unitPrice || item.value || item.basePrice || '0');
        const categoryName = item.category || item.menuSection || item.group || item.category_name || 'Geral';
        const description = item.description || item.details || item.shortDescription || '';
        const imageUrl = item.imageUrl || item.image || item.image_url || '';
        if (!name) continue;
        const variants: any[] = [];
        const optionsSource = item.options || item.choices || item.modifiers || item.garnishes || [];
        if (Array.isArray(optionsSource)) {
            for (const opt of optionsSource) {
                if (opt.options && Array.isArray(opt.options)) {
                    for (const subOpt of opt.options) {
                        if (subOpt.name) variants.push({ name: subOpt.name, price: parseFloat(subOpt.price || subOpt.value || '0') });
                    }
                } else if (opt.name) {
                    variants.push({ name: opt.name, price: parseFloat(opt.price || opt.value || '0') });
                }
            }
        }
        if (!categoriesMap[categoryName]) categoriesMap[categoryName] = [];
        categoriesMap[categoryName].push({ name, price, description, image_url: imageUrl, variants });
    }
    return Object.entries(categoriesMap).map(([name, items]) => ({ name, items }));
}

async function processWithAI(content: string, apiKey: string | undefined, isImage = false, isJson = false) {
    if (!apiKey) throw new Error('Chave OpenAI não configurada.');
    const systemPrompt = `Você é um especialista em estruturar cardápios. Extraia produtos, preços e VARIAÇÕES. SAÍDA JSON: { "categories": [ { "name": "Nome", "items": [ { "name": "Produto", "price": 0.00, "variants": [] } ] } ] }`;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isImage ? [{ type: "text", text: "Extraia o cardápio." }, { type: "image_url", image_url: { url: content, detail: "high" } }] : `Extraia o cardápio:\n\n${content.slice(0, 50000)}` }
    ];
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: messages, temperature: 0.1, max_tokens: 4000, response_format: { type: "json_object" } })
    });
    if (!aiResp.ok) { const err = await aiResp.text(); throw new Error(`Erro IA: ${err}`); }
    const aiData = await aiResp.json();
    const parsed = JSON.parse(aiData.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());
    return new Response(JSON.stringify({ success: true, status: 'completed', categories: parsed.categories || parsed.menu || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
}
