
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
      throw new Error('Chave da API OpenAI não configurada. Configure a chave OPENAI_API_KEY nos segredos do Supabase.');
    }

    let userPrompt = '';
    let contentPayload: any[] = [];

    const jsonStructure = `
    {
      "categories": [
        {
          "name": "Nome da Categoria (Ex: Bebidas, Lanches)",
          "items": [
            {
              "name": "Nome do Produto",
              "description": "Descrição detalhada (incluindo acompanhamentos)",
              "price": 10.50,
              "image_url": "URL da imagem (se site)",
              "image_prompt": "Descrição visual em inglês para gerar imagem (se foto)",
              "variants": [
                { "name": "Variação (Ex: Lata 350ml)", "price": 5.00 },
                { "name": "Variação (Ex: 600ml)", "price": 7.00 }
              ]
            }
          ]
        }
      ]
    }`;

    if (url) {
      try {
        new URL(url);
      } catch {
        throw new Error('URL inválida');
      }

      console.log(`Fetching URL via Jina Reader: ${url}`);
      
      const jinaUrl = `https://r.jina.ai/${url}`;
      
      const response = await fetch(jinaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BoraCumeBot/1.0)',
          'Accept': 'text/plain,text/markdown',
          'X-Return-Format': 'markdown'
        }
      });

      if (!response.ok) {
        console.log('Jina Reader failed, falling back to direct fetch...');
        // Fallback robusto: se Jina falhar, tentar buscar o HTML e extrair apenas o BODY para economizar tokens
        const directResponse = await fetch(url);
        if (!directResponse.ok) throw new Error(`Falha ao acessar o site: ${response.status}`);
        const html = await directResponse.text();
        // Limitar tamanho do HTML para não estourar tokens de entrada
        userPrompt = `Analise o HTML bruto abaixo. Extraia o cardápio completo. Texto: ${html.slice(0, 30000)}`;
      } else {
        const markdown = await response.text();
        const cleanMarkdown = markdown.slice(0, 50000); 
        
        userPrompt = `Analise este cardápio (formato Markdown). Extraia TODOS os produtos, organizados por CATEGORIAS.
        
        Cardápio:
        ${cleanMarkdown}`;
      }
      
    } else if (imageBase64) {
      // Prompt Avançado para Cardápios Densos (Pizzarias)
      userPrompt = `Analise esta imagem de cardápio.
      Sua missão é extrair TODOS os produtos e suas variações de preço.
      
      REGRAS PARA PIZZAS E VARIAÇÕES (CRUCIAL):
      1. Se um produto tiver vários preços na mesma linha (ex: "PP. 10,00 - P. 20,00 - M. 30,00"), você DEVE criar VARIAÇÕES no array "variants".
      2. Exemplo de saída correta para "Calabresa ... P 20,00 / G 30,00":
         {
           "name": "Calabresa",
           "price": 20.00, // Preço da menor variação como base
           "variants": [
             { "name": "Pequena (P)", "price": 20.00 },
             { "name": "Grande (G)", "price": 30.00 }
           ]
         }
      3. NÃO IGNORE NENHUM SABOR. Leia a lista completa de cima a baixo.
      4. Extraia a descrição dos ingredientes (ex: "molho, mussarela, cebola") para o campo "description".
      
      Saída JSON:
      ${jsonStructure}`;

      contentPayload = [
        {
          type: "text",
          text: userPrompt
        },
        {
          type: "image_url",
          image_url: {
            url: imageBase64,
            detail: "high" // Voltamos para HIGH para ler letras pequenas de preços
          },
        },
      ];
    } else {
      throw new Error('URL ou Imagem é obrigatório.');
    }

    // Apenas adicione instruções extras se for texto, pois para imagem já colocamos no contentPayload
    if (!imageBase64) {
      userPrompt += `
      
      REGRAS ESTRITAS DE SAÍDA:
      1. Retorne APENAS um JSON válido seguindo estritamente esta estrutura:
      ${jsonStructure}
      
      2. Se um produto tiver variações de tamanho/tipo com preços diferentes, use o array "variants".
      3. Se houver opcionais ou acompanhamentos com preço (ex: "Adicional de Bacon +R$2"), trate como variação.
      4. Converta preços para número (ponto flutuante).
      5. IMPORTANTE: Tente extrair URLs de imagens dos produtos se estiver analisando um site ou HTML.
      6. Se for imagem enviada pelo usuário, PREENCHA o campo "image_prompt" com uma descrição rica em inglês para gerar a imagem depois.
      7. NÃO adicione texto markdown (\`\`\`json) antes ou depois. Apenas o JSON puro.
      `;
    }

    if (imageBase64) {
      // Para imagens, o prompt já está no contentPayload estruturado acima
      // contentPayload já está pronto
    } else {
      contentPayload = [{ type: "text", text: userPrompt }];
    }

    // MODO DE DIAGNÓSTICO ATIVADO TEMPORARIAMENTE
    if (imageBase64) {
      console.log('Recebida imagem, tamanho:', imageBase64.length);
      // Se a imagem for muito grande, o problema pode ser esse.
      // Vamos tentar processar com GPT-4o mas com um timeout menor para falhar rápido se for o caso
    }

    // Selecionar modelo mais adequado: GPT-4o (Standard) para Imagens (mais rápido no visual)
    // GPT-4o-mini para Texto/URL (mais barato e eficiente para texto)
    const aiModel = imageBase64 ? 'gpt-4o' : 'gpt-4o-mini';
    
    console.log(`Using AI Model: ${aiModel}`);

    // Aumentar o limite de tokens para suportar cardápios longos
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especialista em estruturar dados de cardápios. Retorne apenas JSON.'
          },
          {
            role: 'user',
            content: contentPayload
          }
        ],
        temperature: 0.1,
        max_tokens: 4096, // Reduzido de 12000 para evitar timeout na resposta
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      throw new Error(`Erro na OpenAI (${aiResponse.status}): ${errorData}`);
    }

    const aiData = await aiResponse.json();
    console.log('OpenAI Response:', aiData);

    if (!aiData.choices || !aiData.choices[0]) {
      throw new Error('No response from OpenAI');
    }

    const rawContent = aiData.choices[0].message.content;
    
    console.log('AI Raw Response:', rawContent);

    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch (e) {
      try {
        const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanJson);
      } catch (e2) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "A IA não retornou um JSON válido.",
            raw_response: rawContent
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
    }

    // Normalize response
    let categories = [];
    if (parsedData.categories) {
      categories = parsedData.categories;
    } else if (parsedData.products) {
      // If AI returned flat list, group into "Geral"
      categories = [{ name: "Geral", items: parsedData.products }];
    } else if (Array.isArray(parsedData)) {
       categories = [{ name: "Geral", items: parsedData }];
    }

    // Limitar o processamento de imagem para não estourar o tempo limite da Edge Function (60s)
     // IMPORTANTE: Só gerar imagens se não veio URL do produto na importação (ex: iFood já traz imagem)
     let imagesGenerated = 0;
     const MAX_IMAGES_PER_REQUEST = 3; 
 
     for (const category of categories) {
       for (const product of category.items || []) {
         // Se já tem image_url (veio do link), NÃO gera imagem nova com IA. Economiza tempo e dinheiro.
         if (product.image_prompt && !product.image_url && imagesGenerated < MAX_IMAGES_PER_REQUEST) {
            try {
              console.log(`Generating image for: ${product.name}`);
            const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: `Professional food photography of ${product.name}. ${product.image_prompt}. High resolution, studio lighting, appetizing, 4k.`,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                response_format: "url"
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.data && imageData.data[0] && imageData.data[0].url) {
                product.image_url = imageData.data[0].url;
                imagesGenerated++;
              }
            } else {
               console.error(`Failed to generate image for ${product.name}:`, await imageResponse.text());
            }
          } catch (imgError) {
            console.error(`Error generating image for ${product.name}:`, imgError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        categories: categories,
        raw_response: rawContent
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
        status: 200 
      }
    )
  }
})
