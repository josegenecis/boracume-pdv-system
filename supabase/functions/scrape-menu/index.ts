import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ⚠️ Configuração de Browserless (Opcional, mas recomendado para iFood/Rappi)
// Se não tiver chave, o sistema usa fallback Jina/Fetch.
// Para configurar: `npx supabase secrets set BROWSERLESS_API_KEY=seu_token`
const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');

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
    } 
    // ==========================================
    // MODO 2: URL (Scraping) - Mais Complexo
    // ==========================================
    else if (type === 'url') {
      let textContent = "";
      
      // Tentativa 1: Browserless (Se configurado) - Ideal para iFood/SPA
      if (BROWSERLESS_API_KEY) {
          try {
              console.log('[ScrapeMenu] Tentando Browserless/Puppeteer...');
              // Chamada direta à API REST do Browserless para evitar deps pesadas
              const browserlessResp = await fetch(`https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}&stealth=true`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      url: data,
                      waitFor: 'networkidle2', // Espera SPA carregar
                      rejectResourceTypes: ['image', 'font', 'media'] // Otimização
                  })
              });
              
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

      // Tentativa 2: Jina.ai (Se Browserless falhou ou não existe)
      if (!textContent) {
          try {
            console.log('[ScrapeMenu] Tentando Jina.ai...');
            const jinaResp = await fetch(`https://r.jina.ai/${data}`);
            if (jinaResp.ok) {
                textContent = await jinaResp.text();
            } else {
                console.warn('[ScrapeMenu] Jina falhou:', jinaResp.status);
            }
          } catch (jinaError) {
             console.warn('[ScrapeMenu] Erro Jina:', jinaError);
          }
      }

      // Tentativa 3: Fetch Simples (Fallback final)
      if (!textContent) {
        try {
            console.log('[ScrapeMenu] Tentando Fetch direto (Fallback)...');
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            };
            const resp = await fetch(data, { headers });
            if (resp.ok) textContent = await resp.text();
        } catch (e) {
            console.error('[ScrapeMenu] Fetch falhou:', e);
        }
      }

      if (!textContent || textContent.length < 100) {
          throw new Error('Não foi possível ler o conteúdo do site. Tente usar a opção "IMAGEM" tirando um print do cardápio.');
      }

      // Limpeza para economizar tokens
      const cleanText = textContent
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 60000); // Limite seguro de caracteres

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
