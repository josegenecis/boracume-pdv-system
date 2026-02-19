
// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function scrape-menu V3 (Native Deno.serve) iniciada!");

Deno.serve(async (req) => {
  // 1. Tratamento de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Parse do Body
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

    // Configurações (Lidas do Ambiente)
    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // 3. Validação de Chaves Críticas
    if (type === 'image' && !OPENAI_API_KEY) {
         throw new Error('Configuração de IA (OPENAI_API_KEY) ausente no servidor.');
    }

    // ==========================================
    // FLUXO DE IMPORTAÇÃO
    // ==========================================
    
    // --- CASO 1: URL (IFOOD/RAPPI/OUTROS) ---
    if (type === 'url') {
        
        // A. Tentar APIFY (Prioridade para iFood)
        if (APIFY_TOKEN && data.includes('ifood.com.br')) {
            try {
                console.log('[ScrapeMenu] Detectado iFood. Usando Actor priscilas/ifood-menu-scraper...');
                // Actor específico para iFood (mais confiável que o genérico)
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
                    console.error('[ScrapeMenu] Erro ao iniciar Apify iFood:', err);
                    throw new Error(`Apify iFood Start Failed: ${startResp.status}`);
                }

                const startData = await startResp.json();
                const runId = startData.data.id;
                const datasetId = startData.data.defaultDatasetId;
                console.log('[ScrapeMenu] iFood Run ID:', runId);

                // Polling (Esperar terminar - iFood pode demorar)
                let status = 'RUNNING';
                const startTime = Date.now();
                
                while (status === 'RUNNING' || status === 'READY') {
                    if (Date.now() - startTime > 110000) break; // Timeout 110s (limite da function é 120s)
                    await new Promise(r => setTimeout(r, 5000)); // Checar a cada 5s
                    
                    const checkResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
                    const checkData = await checkResp.json();
                    status = checkData.data.status;
                }

                if (status === 'SUCCEEDED') {
                    const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
                    const items = await itemsResp.json();
                    
                    if (items && items.length > 0) {
                        console.log(`[ScrapeMenu] iFood retornou ${items.length} itens brutos.`);
                        // O scraper do iFood retorna JSON estruturado.
                        // Podemos passar esse JSON para a IA normalizar para o nosso formato.
                        const jsonContent = JSON.stringify(items.slice(0, 50)); // Limitar para não estourar token
                        return await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
                    }
                }
            } catch (e) {
                console.warn('[ScrapeMenu] Apify iFood falhou, tentando fallback genérico...', e);
            }
        }

        // B. Tentar APIFY Genérico (Outros sites ou fallback)
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
                console.log('[ScrapeMenu] Usando Browserless...');
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
            console.log('[ScrapeMenu] Usando Jina...');
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
    // Retorna 200 OK com erro JSON para o frontend exibir
    return new Response(
      JSON.stringify({ success: false, error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
})

// Função Auxiliar para chamar OpenAI
async function processWithAI(content: string, apiKey: string | undefined, isImage = false, isJson = false) {
    if (!apiKey) throw new Error('Chave OpenAI não configurada (necessária para processar o texto/imagem).');

    const systemPrompt = `Você é um especialista em estruturar cardápios de restaurantes.
    Sua missão é extrair produtos, preços e VARIAÇÕES/COMPLEMENTOS do conteúdo fornecido.
    
    IMPORTANTE SOBRE VARIAÇÕES:
    - Procure por tamanhos (P, M, G), sabores, adicionais, bordas, ou opções de escolha.
    - Se um produto tiver opções com preços diferentes, crie "variants".
    - Se houver adicionais pagos, crie "variants" com o nome do adicional e seu preço.
    
    ESTRUTURA JSON OBRIGATÓRIA:
    {
      "categories": [
        {
          "name": "Nome da Categoria (Ex: Lanches, Bebidas)",
          "items": [ 
            { 
              "name": "Nome do Produto", 
              "price": 0.00, 
              "description": "Descrição detalhada", 
              "variants": [ 
                  { "name": "Bacon Extra", "price": 5.00 },
                  { "name": "Tamanho Grande", "price": 10.00 }
              ] 
            } 
          ]
        }
      ]
    }
    REGRAS:
    1. Retorne APENAS o JSON puro.
    2. Ignore itens que não sejam do cardápio (rodapés, links, etc).
    3. Se o preço for "A partir de", use o menor preço como base e coloque as opções mais caras como variantes.
    4. Normalize os preços para float (ex: 10.50).`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { 
            role: 'user', 
            content: isImage 
                ? [
                    { type: "text", text: "Extraia o cardápio desta imagem em JSON, incluindo todas as variações e opcionais visíveis." },
                    { type: "image_url", image_url: { url: content, detail: "high" } }
                  ]
                : `Analise este conteúdo (${isJson ? 'JSON Estruturado' : 'Texto Bruto'}) e extraia o cardápio:\n\n${content.slice(0, 50000)}`
        }
    ];

    console.log('[ScrapeMenu] Enviando para OpenAI...');
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
        throw new Error(`Erro na IA (${aiResp.status}): ${err}`);
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
