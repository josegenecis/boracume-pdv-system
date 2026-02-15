
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
    const { message } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Chave da API OpenAI não configurada no Supabase Secrets.');
    }

    if (!message) {
      throw new Error('Mensagem é obrigatória.');
    }

    console.log('Sending to OpenAI:', message);

    // Call OpenAI API
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é o assistente inteligente do sistema PDV "Bora Cumê". 
            Sua função é ajudar o dono do restaurante a gerenciar o negócio.
            
            Você deve identificar a INTENÇÃO do usuário e retornar um JSON estruturado para que o frontend execute a ação.
            
            INTENÇÕES POSSÍVEIS:
            1. "DISABLE_INGREDIENT": Quando o usuário quer desativar/remover/tirar um ingrediente.
            2. "REGISTER_EXPENSE": Quando o usuário quer lançar uma despesa/gasto.
            3. "QUERY_INGREDIENTS": Quando o usuário quer ver/listar ingredientes.
            4. "UPDATE_PRODUCT_PRICE": Quando o usuário quer mudar o preço de um produto. (Extrair: "product_name", "new_price").
            5. "TOGGLE_PRODUCT_AVAILABILITY": Quando o usuário quer pausar/desativar ou ativar um produto do cardápio. (Extrair: "product_name", "status": "active" | "inactive").
            6. "CHAT": Conversa geral, dúvidas sobre culinária, gestão, etc.

            FORMATO DE RESPOSTA (JSON):
            {
              "intent": "DISABLE_INGREDIENT" | "REGISTER_EXPENSE" | "QUERY_INGREDIENTS" | "UPDATE_PRODUCT_PRICE" | "TOGGLE_PRODUCT_AVAILABILITY" | "CHAT",
              "parameters": { ... }, 
              "reply": "Texto de resposta amigável para o usuário"
            }

            Exemplos:
            User: "Mude o preço do X-Bacon para 30 reais"
            Response: { "intent": "UPDATE_PRODUCT_PRICE", "parameters": { "product_name": "X-Bacon", "new_price": 30 }, "reply": "Certo, alterando preço do X-Bacon." }

            User: "Acabou a Coca-Cola, desativa ela"
            Response: { "intent": "TOGGLE_PRODUCT_AVAILABILITY", "parameters": { "product_name": "Coca-Cola", "status": "inactive" }, "reply": "Ok, pausando a venda de Coca-Cola." }
            `
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`Erro na API OpenAI: ${aiResponse.status} - ${errorData}`);
    }

    const aiData = await aiResponse.json();
    console.log('OpenAI Success Response');
    
    const content = JSON.parse(aiData.choices[0].message.content);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: content
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 even on error to avoid CORS issues in browser, handle success: false in frontend
      }
    )
  }
})
