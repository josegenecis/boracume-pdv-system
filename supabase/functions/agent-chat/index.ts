
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
    const { message } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('Chave da API OpenAI não configurada.');
    }

    if (!message) {
      throw new Error('Mensagem é obrigatória.');
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
            content: `Você é o assistente inteligente do sistema PDV "Bora Cumê". 
            Sua função é ajudar o dono do restaurante a gerenciar o negócio.
            
            Você deve identificar a INTENÇÃO do usuário e retornar um JSON estruturado para que o frontend execute a ação.
            
            INTENÇÕES POSSÍVEIS:
            1. "DISABLE_INGREDIENT": Quando o usuário quer desativar/remover/tirar um ingrediente.
            2. "REGISTER_EXPENSE": Quando o usuário quer lançar uma despesa/gasto.
            3. "QUERY_INGREDIENTS": Quando o usuário quer ver/listar ingredientes.
            4. "CHAT": Conversa geral, dúvidas sobre culinária, gestão, etc.

            FORMATO DE RESPOSTA (JSON):
            {
              "intent": "DISABLE_INGREDIENT" | "REGISTER_EXPENSE" | "QUERY_INGREDIENTS" | "CHAT",
              "parameters": { ... }, // Parâmetros extraídos (ex: nome do ingrediente, valor da despesa)
              "reply": "Texto de resposta amigável para o usuário"
            }

            Exemplos:
            User: "Tirar carne de sol de tudo"
            Response: { "intent": "DISABLE_INGREDIENT", "parameters": { "ingredient": "carne de sol" }, "reply": "Entendido, vou desativar a carne de sol." }

            User: "Gastei 50 reais com uber"
            Response: { "intent": "REGISTER_EXPENSE", "parameters": { "amount": 50, "category": "transporte", "description": "Uber" }, "reply": "Certo, registrando R$ 50,00 em transporte." }

            User: "Como faço um bom strogonoff?"
            Response: { "intent": "CHAT", "reply": "Para um bom strogonoff, o segredo é..." }
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
      console.error('OpenAI Error:', errorData);
      throw new Error(`Erro na IA: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
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
