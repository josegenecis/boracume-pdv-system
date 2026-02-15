
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
      throw new Error('Chave OpenAI não configurada.');
    }

    // 1. Definição Simplificada do Payload para a IA
    let messages = [];

    // Estrutura de saída desejada (SIMPLIFICADA)
    const systemPrompt = `Você é um assistente de extração de cardápios.
    Sua única tarefa é extrair os produtos e retornar um JSON puro.
    
    ESTRUTURA OBRIGATÓRIA DO JSON:
    {
      "categories": [
        {
          "name": "Nome da Categoria (ex: Pizzas, Bebidas)",
          "items": [
            {
              "name": "Nome do Produto",
              "description": "Ingredientes ou descrição",
              "price": 0.00, // Use ponto para decimais
              "image_url": "", // Se encontrar URL de imagem no texto, coloque aqui. Se for foto, deixe vazio.
              "variants": [ // Opcional: Se houver tamanhos/sabores com preços diferentes
                 { "name": "Pequena", "price": 20.00 },
                 { "name": "Grande", "price": 30.00 }
              ]
            }
          ]
        }
      ]
    }

    REGRAS:
    - Se for imagem de pizzaria com múltiplos preços (P, M, G), CRIE VARIAÇÕES.
    - Se for site (texto), extraia tudo que parecer produto.
    - NÃO INVENTE DADOS.
    - Retorne APENAS o JSON, sem markdown (\`\`\`).
    `;

    if (imageBase64) {
      // Fluxo de Imagem
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: "text", text: "Extraia o cardápio desta imagem em JSON." },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } } // High detail para ler preços pequenos
          ] 
        }
      ];
    } else if (url) {
      // Fluxo de URL (Simplificado: Tenta Jina, se falhar, tenta fetch direto)
      console.log(`Lendo URL: ${url}`);
      
      let textContent = "";
      
      try {
        const jinaResponse = await fetch(`https://r.jina.ai/${url}`);
        if (jinaResponse.ok) {
           textContent = await jinaResponse.text();
        } else {
           throw new Error("Jina falhou");
        }
      } catch {
        console.log("Fallback para fetch direto...");
        const directResp = await fetch(url);
        textContent = await directResp.text();
      }

      // Limita o texto para não estourar tokens (50k chars é seguro para gpt-4o-mini)
      const cleanText = textContent.slice(0, 50000);

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extraia o cardápio deste texto/site:\n\n${cleanText}` }
      ];
    } else {
      throw new Error('Nenhuma imagem ou URL fornecida.');
    }

    console.log("Enviando para OpenAI...");

    // 2. Chamada para OpenAI (GPT-4o para tudo, para garantir inteligência)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Usando o modelo mais inteligente para garantir que leia pizzas complexas
        messages: messages,
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("Erro OpenAI:", err);
      throw new Error(`Erro OpenAI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices[0].message.content;
    console.log("Resposta IA recebida.");

    // 3. Parse e Limpeza
    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch {
      // Tenta limpar markdown se houver
      const clean = rawContent.replace(/```json/g, '').replace(/```/g, '');
      parsedData = JSON.parse(clean);
    }

    // Normalização final
    const categories = parsedData.categories || parsedData.products || [];

    // 4. Retorno Sucesso
    return new Response(
      JSON.stringify({ success: true, categories: categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro Geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
