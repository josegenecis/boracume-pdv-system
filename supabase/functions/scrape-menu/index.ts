
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
    const { url, imageBase64 } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Chave da API OpenAI não configurada.');
    }

    let userPrompt = '';
    let contentPayload: any[] = [];

    if (url) {
      try {
        new URL(url);
      } catch {
        throw new Error('URL inválida');
      }

      console.log(`Fetching URL via Jina Reader: ${url}`);
      
      // Use jina.ai reader to convert complex SPA sites (like iFood) to LLM-friendly markdown
      const jinaUrl = `https://r.jina.ai/${url}`;
      
      const response = await fetch(jinaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BoraCumeBot/1.0)',
          'Accept': 'text/plain,text/markdown',
          'X-Return-Format': 'markdown'
        }
      });

      if (!response.ok) {
        // Fallback to direct fetch if Jina fails
        console.log('Jina Reader failed, falling back to direct fetch...');
        const directResponse = await fetch(url);
        if (!directResponse.ok) throw new Error(`Falha ao acessar o site: ${response.status}`);
        const html = await directResponse.text();
        // Simple HTML cleanup
        userPrompt = `Analise o HTML bruto abaixo. Tente encontrar produtos e preços. Texto: ${html.slice(0, 15000)}`;
      } else {
        const markdown = await response.text();
        // Limit context to avoid token limits, but keep enough for menu
        const cleanMarkdown = markdown.slice(0, 25000); 
        
        userPrompt = `Analise este cardápio (formato Markdown). Extraia TODOS os produtos alimentícios e bebidas com seus preços.
        Retorne APENAS um JSON válido com a lista de produtos.
        Formato: { "products": [{ "name": "...", "price": 10.50, "description": "..." }] }
        
        Cardápio:
        ${cleanMarkdown}`;
      }
      
      contentPayload = [{ type: "text", text: userPrompt }];

    } else if (imageBase64) {
      userPrompt = `Analise esta imagem de cardápio. Identifique todos os produtos e preços. Retorne APENAS um JSON válido contendo uma lista de objetos com as chaves: "name" (string), "price" (number), "description" (string, opcional).`;

      contentPayload = [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: {
            url: imageBase64,
          },
        },
      ];
    } else {
      throw new Error('URL ou Imagem é obrigatório.');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente JSON. Retorne apenas JSON.'
          },
          {
            role: 'user',
            content: contentPayload
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      throw new Error(`Erro na OpenAI: ${errorData}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices[0].message.content;
    
    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch (e) {
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '');
      parsedData = JSON.parse(cleanJson);
    }

    const products = Array.isArray(parsedData) ? parsedData : (parsedData.products || parsedData.items || []);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products: products,
        count: products.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 to prevent CORS errors masking the real error
      }
    )
  }
})
