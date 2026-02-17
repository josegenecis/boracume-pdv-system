
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
    const { url, imageBase64, isImageUpload } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Chave OpenAI não configurada.');
    }

    // 1. Definição Simplificada do Payload para a IA
    let messages = [];

    // Estrutura de saída desejada (SIMPLIFICADA AO EXTREMO)
    const systemPrompt = `Você é um especialista em ler cardápios.
    Sua tarefa é extrair TODOS os produtos da imagem/texto e retornar um JSON.
    
    ATENÇÃO MÁXIMA PARA PIZZARIAS E PREÇOS:
    - Se encontrar algo como "Mussarela ... P 20 / M 30 / G 40", isso é UM produto com 3 variações.
    - Estruture assim:
      {
        "name": "Mussarela",
        "price": 20.00, // Menor preço
        "variants": [
           { "name": "Pequena (P)", "price": 20.00 },
           { "name": "Média (M)", "price": 30.00 },
           { "name": "Grande (G)", "price": 40.00 }
        ]
      }
    - Leia todas as colunas. Não ignore nada.
    
    FORMATO JSON DE RESPOSTA:
    {
      "categories": [
        {
          "name": "Categoria",
          "items": [ { "name": "X", "price": 0, "description": "", "variants": [] } ]
        }
      ]
    }`;

    // DETECÇÃO INTELIGENTE DE TIPO
    // Se for upload de imagem OU url de imagem (termina em jpg/png/webp)
    const isImage = imageBase64 || isImageUpload || (url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url));

    if (isImage) {
      // Fluxo de Imagem (Vision)
      const imageUrl = url || imageBase64; // Agora suporta URL direta para Vision!
      
      console.log(`Processando Imagem via Vision (URL: ${!!url}, Base64: ${!!imageBase64})`);

      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: "text", text: "Extraia o cardápio desta imagem em JSON." },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } } 
          ] 
        }
      ];
    } else if (url) {
      // Fluxo de Site (Texto)
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

    // 2. Chamada para OpenAI (GPT-4o-mini para TUDO, inclusive Visão)
    // Motivo: O GPT-4o padrão é lento demais e causa timeout na Edge Function.
    // O mini é rápido o suficiente e tem visão competente.
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
