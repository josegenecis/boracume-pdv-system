import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body?.name || "").trim()
    const category = String(body?.category || "").trim()
    const price = Number(body?.price ?? 0) || 0
    const currentDescription = String(body?.currentDescription || "").trim()

    if (!name) {
      return new Response(JSON.stringify({ ok: false, error: "missing_name" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openAiKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_openai_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const prompt = [
      "Gere uma descrição curta e atrativa para um produto de cardápio em português (pt-BR).",
      "Regras:",
      "- 1 a 2 frases",
      "- não use emojis",
      "- não invente ingredientes específicos se não forem informados",
      "- foque em sabor, textura e ocasião (ex.: ideal para ...)",
      "",
      `Produto: ${name}`,
      category ? `Categoria: ${category}` : "",
      price > 0 ? `Preço: R$ ${price.toFixed(2)}` : "",
      currentDescription ? `Descrição atual (use como base, se fizer sentido): ${currentDescription}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Retorne apenas JSON válido." },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Retorne no formato: {\"description\":\"...\"}\n\n${prompt}`,
              },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    })

    const text = await aiResponse.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    const content = json?.choices?.[0]?.message?.content
    let parsed: any = null
    try {
      parsed = content ? JSON.parse(content) : null
    } catch {
      parsed = null
    }

    const description = String(parsed?.description || "").trim()
    if (!description) {
      return new Response(JSON.stringify({ ok: false, error: "empty_description" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true, description }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
