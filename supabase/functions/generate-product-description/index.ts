import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { geminiGenerateContent, safeParseJson } from "../_shared/gemini.ts"

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

    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY")
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash"
    if (!geminiKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_gemini_key" }), {
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

    const ai = await geminiGenerateContent({
      apiKey: geminiKey,
      model: geminiModel,
      system: "Retorne apenas JSON válido.",
      user: `Retorne no formato: {"description":"..."}\n\n${prompt}`,
      temperature: 0.4,
      responseMimeType: "application/json"
    })

    const parsed: any = safeParseJson(ai.text)
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
