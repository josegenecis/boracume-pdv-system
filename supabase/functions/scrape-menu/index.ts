import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, data } = await req.json();
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) throw new Error('Chave OpenAI não configurada.');
    if (!data) throw new Error('Dados para processamento não fornecidos.');

    console.log(`[ScrapeMenu] Iniciando processamento. Tipo: ${type}`);

    const systemPrompt = `Você é um especialista em ler cardápios.
    Extraia TODOS os produtos e retorne APENAS um JSON válido.
    
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
    
    REGRAS:
    1. Retorne APENAS o JSON puro (sem markdown).
    2. Ignore itens que não sejam comida/bebida.
    3. Se houver variações (P/M/G), agrupe.`;

    let messages = [];

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
      // Tenta Jina.ai para scraping limpo, fallback para fetch direto
      let textContent = "";
      try {
        const jinaResp = await fetch(`https://r.jina.ai/${data}`);
        if (jinaResp.ok) textContent = await jinaResp.text();
        else throw new Error('Jina failed');
      } catch {
        // Fallback simples
        try {
            const resp = await fetch(data);
            textContent = await resp.text();
            // Remove scripts e styles básicos
            textContent = textContent.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                                     .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
                                     .replace(/<[^>]+>/g, ' '); 
        } catch (e) {
            throw new Error(`Falha ao acessar URL: ${e.message}`);
        }
      }

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extraia o cardápio deste conteúdo:\n\n${textContent.slice(0, 50000)}` }
      ];
    } else {
        throw new Error('Tipo de importação inválido.');
    }

    console.log('[ScrapeMenu] Enviando para OpenAI...');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Vision e Texto suportados e rápidos
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error('OpenAI Error:', err);
      throw new Error(`Erro na IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Limpeza agressiva de JSON
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Validação final da estrutura
    const categories = parsed.categories || parsed.menu || [];
    
    return new Response(
      JSON.stringify({ success: true, categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 } // Retorna 200 com success: false para o frontend tratar
    );
  }
})
