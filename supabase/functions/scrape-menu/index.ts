
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

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
      });

      if (!response.ok) {
        throw new Error(`Falha ao acessar o site: ${response.status}`);
      }

      const html = await response.text();
      const cleanText = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 15000);

      userPrompt = `Analise o texto do cardápio e extraia produtos (nome, preço, descrição). Retorne JSON. Texto: ${cleanText}`;
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
