import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    // 1. Validação do Payload
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Corpo da requisição inválido ou vazio (JSON esperado).');
    }

    const { url, imageBase64, isImageUpload } = body;
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Configuração de servidor incompleta: Chave OpenAI ausente.');
    }

    console.log(`[ScrapeMenu] Iniciando processamento. URL: ${!!url}, Imagem: ${!!imageBase64}`);

    // 2. Definição do Prompt e Mensagens
    let messages = [];
    const systemPrompt = `Você é um especialista em ler cardápios.
    Sua tarefa é extrair TODOS os produtos da imagem/texto e retornar APENAS um JSON válido.
    
    REGRAS CRÍTICAS:
    1. Retorne APENAS o JSON puro. NÃO use markdown (sem \`\`\`json).
    2. Se houver variações (P/M/G), agrupe-as no mesmo produto.
    3. Ignore itens que não sejam comida/bebida.
    
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
              "variants": [
                { "name": "Pequena", "price": 10.00 }
              ] 
            } 
          ]
        }
      ]
    }`;

    // Detecção de Tipo (Imagem ou Texto)
    const isImage = imageBase64 || isImageUpload || (url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url));

    if (isImage) {
      const imageUrl = url || imageBase64;
      if (!imageUrl) throw new Error('Imagem não fornecida para processamento.');

      console.log('[ScrapeMenu] Modo: Visão (Imagem)');
      
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: "text", text: "Extraia o cardápio desta imagem seguindo estritamente o formato JSON solicitado." },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } } 
          ] 
        }
      ];
    } else if (url) {
      console.log(`[ScrapeMenu] Modo: Texto (URL: ${url})`);
      
      let textContent = "";
      try {
        // Tenta Jina.ai primeiro para scraping limpo
        const jinaResponse = await fetch(`https://r.jina.ai/${url}`);
        if (jinaResponse.ok) {
           textContent = await jinaResponse.text();
        } else {
           throw new Error(`Jina falhou (${jinaResponse.status})`);
        }
      } catch (e) {
        console.warn(`[ScrapeMenu] Fallback para fetch direto: ${e.message}`);
        try {
          const directResp = await fetch(url);
          if (!directResp.ok) throw new Error(`Fetch direto falhou: ${directResp.status}`);
          textContent = await directResp.text();
        } catch (fetchError) {
          throw new Error(`Não foi possível acessar a URL: ${fetchError.message}`);
        }
      }

      if (!textContent || textContent.length < 50) {
        throw new Error('O site retornou pouco ou nenhum conteúdo de texto.');
      }

      // Limita tamanho para evitar erro de tokens (80k chars ~= 20k tokens)
      const cleanText = textContent.slice(0, 80000);

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extraia o cardápio deste conteúdo:\n\n${cleanText}` }
      ];
    } else {
      throw new Error('Nenhuma URL ou imagem fornecida.');
    }

    // 3. Chamada OpenAI
    console.log('[ScrapeMenu] Enviando para OpenAI (gpt-4o-mini)...');
    
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
      const errText = await aiResponse.text();
      console.error(`[ScrapeMenu] Erro OpenAI (${aiResponse.status}):`, errText);
      throw new Error(`Erro na IA: ${aiResponse.status} - Verifique os logs.`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('A IA retornou uma resposta vazia.');
    }

    // 4. Parsing e Limpeza Robusta
    console.log('[ScrapeMenu] Resposta recebida, processando JSON...');
    let parsedData;
    
    try {
      parsedData = JSON.parse(rawContent);
    } catch (e) {
      console.warn('[ScrapeMenu] JSON inválido direto, tentando limpar markdown...');
      // Remove ```json e ``` e espaços extras
      const clean = rawContent
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      try {
        parsedData = JSON.parse(clean);
      } catch (parseError) {
        console.error('[ScrapeMenu] Falha fatal no parsing. Conteúdo:', rawContent);
        throw new Error('A IA não retornou um JSON válido. Tente novamente com uma imagem mais clara.');
      }
    }

    // Normalização final
    const categories = parsedData.categories || parsedData.products || [];

    if (!Array.isArray(categories) || categories.length === 0) {
       // Tenta verificar se retornou um objeto único ou estrutura diferente
       if (parsedData.menu && Array.isArray(parsedData.menu)) {
         return new Response(JSON.stringify({ success: true, categories: parsedData.menu }), { 
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
         });
       }
       throw new Error('Nenhum produto encontrado no formato esperado.');
    }

    return new Response(
      JSON.stringify({ success: true, categories: categories }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro Geral:', error);
    
    // Retorna erro estruturado que o frontend consegue ler
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno desconhecido',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 // Mantém 500 para indicar falha de servidor, mas com body JSON
      }
    );
  }
})
