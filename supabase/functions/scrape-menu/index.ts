import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Import Apify Client
import { ApifyClient } from 'https://esm.sh/apify-client@2.9.1';

// ⚠️ Configuração de Browserless (Opcional, mas recomendado para iFood/Rappi)
// Se não tiver chave, o sistema usa fallback Jina/Fetch.
// Para configurar: `npx supabase secrets set BROWSERLESS_API_KEY=seu_token`
const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');

// ⚠️ Configuração do APIFY (Melhor solução para iFood)
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, data } = await req.json();
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) throw new Error('Chave OpenAI não configurada.');
    if (!data) throw new Error('Dados para processamento não fornecidos.');

    console.log(`[ScrapeMenu] Iniciando processamento. Tipo: ${type}`);

    // Prompt Sistema (Otimizado)
    const systemPrompt = `Você é um especialista em ler cardápios.
    Sua tarefa é extrair TODOS os produtos da imagem ou texto fornecido e retornar APENAS um JSON válido.
    
    ESTRUTURA JSON OBRIGATÓRIA:
    {
      "categories": [
        {
          "name": "Nome da Categoria",
          "items": [ 
            { 
              "name": "Nome do Produto", 
              "price": 0.00, 
              "description": "Descrição opcional", 
              "variants": [ { "name": "Pequena", "price": 10.00 } ] 
            } 
          ]
        }
      ]
    }
    
    REGRAS CRÍTICAS:
    1. Retorne APENAS o JSON puro. NÃO use markdown (sem \`\`\`json).
    2. Ignore itens que não sejam comida/bebida (ex: horário, endereço).
    3. Se houver variações (P/M/G), agrupe-as no mesmo produto.`;

    let messages = [];

    // ==========================================
    // MODO 1: IMAGEM (Vision API) - Mais Confiável
    // ==========================================
    if (type === 'image') {
      // Vision API (data url base64)
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: "text", text: "Extraia o cardápio desta imagem em JSON." },
            { type: "image_url", image_url: { url: data, detail: "high" } } 
          ] 
        }
      ];
    } else if (type === 'url') {
      let textContent = "";
      let apifyJson = null;

      // ==========================================
      // NOVO: Integração APIFY (Prioridade para iFood/Rappi)
      // ==========================================
      if (APIFY_TOKEN && (data.includes('ifood.com.br') || data.includes('rappi'))) {
          try {
             console.log('[ScrapeMenu] URL de Delivery detectada. Tentando APIFY...');
             const client = new ApifyClient({ token: APIFY_TOKEN });
             
             // Usa o Actor oficial de scraping genérico ou específico do iFood se disponível
             // Vamos usar o 'priscilas/ifood-menu-scraper' que é específico e gratuito/barato
             const run = await client.actor('priscilas/ifood-menu-scraper').call({
                 startUrls: [{ url: data }],
                 proxyConfiguration: { useApifyProxy: true }
             });

             console.log('[ScrapeMenu] Apify Run ID:', run.id);
             const { items } = await client.dataset(run.defaultDatasetId).listItems();
             
             if (items && items.length > 0) {
                 // Apify retorna texto limpo ou markdown
                 textContent = items[0].text || items[0].markdown;
                 // Se o Apify retornou JSON (para ifood-scraper), use-o direto
                 apifyJson = items[0]; 
                 console.log('[ScrapeMenu] Sucesso com Apify!');
             }
          } catch (apifyErr) {
             console.warn('[ScrapeMenu] Erro Apify:', apifyErr);
          }
      }
      
      // Se Apify retornou JSON estruturado (caso use scraper específico do iFood), retorna direto
      if (apifyJson && apifyJson.menu) {
           return new Response(
              JSON.stringify({ success: true, categories: apifyJson.menu }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
      }

      // Tentativa 2: Browserless com TIMEOUT de 30s
      if (!textContent && BROWSERLESS_API_KEY) {
          try {
              console.log('[ScrapeMenu] Tentando Browserless/Puppeteer...');
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

              const browserlessResp = await fetch(`https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}&stealth=true`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      url: data,
                      waitFor: 'networkidle2', // Espera SPA carregar
                      rejectResourceTypes: ['image', 'font', 'media'] // Otimização
                  }),
                  signal: controller.signal
              });
              
              clearTimeout(timeoutId);

              if (browserlessResp.ok) {
                  textContent = await browserlessResp.text();
                  console.log('[ScrapeMenu] Sucesso com Browserless (HTML extraído).');
              } else {
                  console.warn('[ScrapeMenu] Browserless falhou:', browserlessResp.status);
              }
          } catch (bErr) {
              console.warn('[ScrapeMenu] Erro Browserless:', bErr);
          }
      }

      // Tentativa 3: Firecrawl (Scraping Inteligente) se Browserless falhar
      if (!textContent) {
          try {
             console.log('[ScrapeMenu] Tentando Firecrawl...');
             // Endpoint público que geralmente funciona melhor que Jina para SPAs
             const firecrawlResp = await fetch('https://api.firecrawl.dev/v0/scrape', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ url: data })
             });
             
             if (firecrawlResp.ok) {
                 const fireData = await firecrawlResp.json();
                 textContent = fireData.data?.markdown || fireData.data?.content;
             }
          } catch(fireErr) {
             console.warn('[ScrapeMenu] Firecrawl falhou:', fireErr);
          }
      }

      // Tentativa 4: Jina.ai (Último recurso de scraping inteligente)
      if (!textContent) {
          try {
            console.log('[ScrapeMenu] Tentando Jina.ai...');
            const jinaResp = await fetch(`https://r.jina.ai/${data}`);
            if (jinaResp.ok) {
                textContent = await jinaResp.text();
            }
          } catch (jinaError) {
             console.warn('[ScrapeMenu] Erro Jina:', jinaError);
          }
      }
      
      // Validação final de conteúdo
      if (!textContent || textContent.length < 50) {
          // Se falhou tudo, retorna erro explícito para o usuário saber o que fazer
          throw new Error('O site bloqueou o acesso automático. Por favor, tire um PRINT/FOTO do cardápio e use a opção "Imagem" (é infalível).');
      }

      // Limpeza agressiva para caber no contexto e remover lixo
      const cleanText = textContent
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 45000); // Reduzi para 45k para garantir que cabe no prompt

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extraia o cardápio deste conteúdo HTML/Texto:\n\n${cleanText}` }
      ];
    } else {
        throw new Error('Tipo de importação inválido.');
    }

    // ==========================================
    // CHAMADA OPENAI
    // ==========================================
    console.log('[ScrapeMenu] Enviando para OpenAI...');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error('OpenAI Error:', err);
      throw new Error(`Erro na IA (${aiResponse.status}): Verifique sua chave de API.`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) throw new Error('A IA retornou uma resposta vazia.');

    // Parsing Robusto
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
        console.error('JSON Parse Error:', cleanJson);
        throw new Error('A IA não retornou um JSON válido.');
    }

    const categories = parsed.categories || parsed.menu || [];
    
    if (!categories.length) {
        throw new Error('Nenhum produto identificado. Tente uma imagem mais clara.');
    }

    return new Response(
      JSON.stringify({ success: true, categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro Fatal:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido no servidor.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
