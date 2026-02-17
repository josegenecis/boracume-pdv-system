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
    const { imageUrl, productName } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openAiKey) {
      throw new Error('Chave OpenAI não configurada')
    }

    if (!imageUrl && !productName) {
      throw new Error('Imagem ou nome do produto obrigatórios')
    }

    let imagePrompt = "";

    // 1. Se tem imagem, usa Vision para descrever (Reverse Engineering)
    if (imageUrl) {
      console.log("Analisando imagem atual com Vision...");
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: "text", text: "Descreva esta comida em detalhes apetitosos para um fotógrafo profissional recriá-la em estúdio. Foco na iluminação, textura e empratamento. Seja breve (max 50 palavras)." },
                { type: "image_url", image_url: { url: imageUrl, detail: "low" } }
              ]
            }
          ],
          max_tokens: 100
        }),
      });

      const visionData = await visionResponse.json();
      const description = visionData.choices?.[0]?.message?.content;
      if (description) {
        imagePrompt = `Professional food photography of ${description}. High resolution, 8k, studio lighting, appetizing, delicious.`;
      }
    } 
    
    // 2. Se não tem imagem (ou Vision falhou), usa o nome do produto
    if (!imagePrompt) {
      imagePrompt = `Professional food photography of delicious ${productName || "gourmet dish"}. High resolution, 8k, studio lighting, appetizing.`;
    }

    console.log("Gerando nova imagem com DALL-E 3:", imagePrompt);

    // 3. Gera nova imagem com DALL-E 3
    const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "standard"
      }),
    });

    const dalleData = await dalleResponse.json();

    if (dalleData.error) {
      console.error("Erro DALL-E:", dalleData.error);
      throw new Error(`Erro ao gerar imagem: ${dalleData.error.message}`);
    }

    const generatedImageBase64 = dalleData.data?.[0]?.b64_json;

    if (!generatedImageBase64) {
      throw new Error('Falha ao gerar imagem (sem retorno da IA)');
    }

    // Retorna a imagem em Base64 para o frontend exibir/salvar
    return new Response(
      JSON.stringify({ 
        ok: true, 
        imageBase64: `data:image/png;base64,${generatedImageBase64}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
