
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { geminiGenerateContent, safeParseJson } from "../_shared/gemini.ts"

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
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (!geminiKey) {
      throw new Error('Chave da API Gemini não configurada no Supabase Secrets (GEMINI_API_KEY).');
    }

    if (!message) {
      throw new Error('Mensagem é obrigatória.');
    }

    const system = `Você é o assistente inteligente do sistema PDV "Bora Cumê". 
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
            `;

    const ai = await geminiGenerateContent({
      apiKey: geminiKey,
      model: geminiModel,
      system,
      user: String(message),
      temperature: 0.2,
      responseMimeType: 'application/json'
    });

    const content = safeParseJson(ai.text);
    if (!content) {
      throw new Error('Resposta inválida do modelo (JSON não parseável).');
    }

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
