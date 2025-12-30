
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, imageBase64 } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Chave da API OpenAI não configurada. Configure OPENAI_API_KEY nos segredos do Supabase.');
    }

    let userPrompt = '';
    let contentPayload: any[] = [];

    if (url) {
      console.log(`Processing URL: ${url}`);
      try {
        new URL(url);
      } catch {
        throw new Error('URL inválida');
      }

      // Fetch the HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });

      if (!response.ok) {
        throw new Error(`Falha ao acessar o site: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      // Remove scripts, styles and excessive whitespace to reduce token count
      const cleanText = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 15000); // Limit context window to save tokens/costs

      userPrompt = `Analise o seguinte texto extraído de um site de cardápio. Extraia todos os produtos alimentícios e bebidas com seus respectivos preços. 
      Retorne APENAS um JSON válido contendo uma lista de objetos com as chaves: "name" (string), "price" (number), "description" (string, opcional).
      Ignore itens que não sejam produtos (como taxas, rodapés, menus de navegação).
      
      Texto do site:
      ${cleanText}`;
      
      contentPayload = [{ type: "text", text: userPrompt }];

    } else if (imageBase64) {
      console.log('Processing Image...');
      userPrompt = `Analise esta imagem de cardápio. Identifique todos os produtos e preços.
      Retorne APENAS um JSON válido contendo uma lista de objetos com as chaves: "name" (string), "price" (number), "description" (string, opcional).
      Se houver categorias, você pode incluir no nome (ex: "Bebidas - Coca Cola").`;

      contentPayload = [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: {
            url: imageBase64, // Expecting data:image/jpeg;base64,...
          },
        },
      ];
    } else {
      throw new Error('URL ou Imagem é obrigatório.');
    }

    // Call OpenAI API
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
            content: 'Você é um assistente especializado em estruturar dados de cardápios de restaurantes. Você deve sempre retornar APENAS um JSON puro, sem markdown (```json), sem explicações adicionais.'
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
      console.error('OpenAI Error:', errorData);
      throw new Error(`Erro na IA: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices[0].message.content;
    
    console.log('AI Response:', rawContent);

    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch (e) {
      // Fallback if AI returns wrapped markdown
      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '');
      parsedData = JSON.parse(cleanJson);
    }

    // Normalize structure (handle if AI returns { "products": [...] } or just [...])
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
        status: 400
      }
    )
  }
})
