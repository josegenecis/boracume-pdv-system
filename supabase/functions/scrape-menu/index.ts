
// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function scrape-menu V4 (Direct Mapping) iniciada!");

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
                console.log('[ScrapeMenu] Detectado iFood. Usando Actor priscilas/ifood-menu-scraper...');
                const runUrl = `https://api.apify.com/v2/acts/priscilas~ifood-menu-scraper/runs?token=${APIFY_TOKEN}`;
                
                const startResp = await fetch(runUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startUrls: [{ url: data }],
                        proxyConfiguration: { useApifyProxy: true }
                    })
                });

                if (!startResp.ok) {
                    const err = await startResp.text();
                    throw new Error(`Apify Start Failed: ${startResp.status} - ${err}`);
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
                        console.log(`[ScrapeMenu] iFood retornou ${items.length} itens. Tentando mapeamento direto...`);
                        
                        // TENTATIVA 1: Mapeamento Direto (Sem gastar IA)
                        const mappedCategories = mapApifyItemsToCategories(items);
                        
                        if (mappedCategories.length > 0) {
                            console.log('[ScrapeMenu] Mapeamento direto funcionou!', mappedCategories.length, 'categorias.');
                            return new Response(
                                JSON.stringify({ success: true, categories: mappedCategories }),
                                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                            );
                        }
                        
                        // TENTATIVA 2: IA (Fallback se mapeamento falhar)
                        console.log('[ScrapeMenu] Mapeamento direto falhou. Usando IA...');
                        // Pega uma amostra maior e mais limpa
                        const jsonContent = JSON.stringify(items.slice(0, 80)); 
                        return await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
                    } else {
                        throw new Error('Apify retornou lista vazia de itens.');
                    }
                } else {
                    throw new Error(`Apify não terminou com sucesso. Status: ${status}`);
                }
            } catch (e: any) {
                console.error('[ScrapeMenu] Erro no fluxo iFood:', e);
                // Retornar erro legível para o front
                return new Response(
                    JSON.stringify({ success: false, error: `Erro na leitura do iFood: ${e.message}` }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }
        }

        // B. Tentar APIFY Genérico
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
    
    // Tenta encontrar o padrão de dados.
    // O scraper priscilas/ifood-menu-scraper geralmente retorna uma lista plana de itens.
    // Ex: { title: "X-Bacon", price: 20, menuSection: "Lanches", options: [...] }
    
    for (const item of items) {
        // Normalização de campos
        const name = item.title || item.name || item.productName;
        const price = parseFloat(item.price || item.unitPrice || item.value || '0');
        const categoryName = item.menuSection || item.category || item.group || 'Geral';
        const description = item.description || item.details || '';
        const imageUrl = item.imageUrl || item.image || '';
        
        if (!name) continue;

        // Processar Variações/Opções
        const variants: any[] = [];
        
        // Se options vier como array de objetos
        if (Array.isArray(item.options)) {
            for (const opt of item.options) {
                if (opt.name && opt.price) {
                     variants.push({ name: opt.name, price: parseFloat(opt.price) });
                } else if (opt.name) {
                     variants.push({ name: opt.name, price: 0 });
                }
            }
        }
        // Se vier como choices ou complements
        if (Array.isArray(item.choices)) {
             for (const choice of item.choices) {
                 if (choice.name) variants.push({ name: choice.name, price: parseFloat(choice.price || '0') });
                 // Se choices tiver options dentro (estrutura aninhada do iFood)
                 if (Array.isArray(choice.options)) {
                     for (const nested of choice.options) {
                         if (nested.name) variants.push({ name: nested.name, price: parseFloat(nested.price || '0') });
                     }
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

    // Converter mapa para array
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
