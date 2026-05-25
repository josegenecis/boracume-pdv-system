// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { geminiGenerateContent, safeParseJson } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanName(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(value: unknown) {
  const unit = String(value || "un").toLowerCase().trim();
  if (["kg", "quilo", "quilograma", "quilogramas"].includes(unit)) return "kg";
  if (["g", "gr", "grama", "gramas"].includes(unit)) return "g";
  if (["l", "lt", "litro", "litros"].includes(unit)) return "l";
  if (["ml", "mililitro", "mililitros"].includes(unit)) return "ml";
  return "un";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function uploadReceipt(supabase: any, userId: string, fileBase64: string, mimeType: string) {
  try {
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("pdf") ? "pdf" : "jpg";
    const path = `smart-invoices/${userId}/${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(fileBase64), (char) => char.charCodeAt(0));
    const { error } = await supabase.storage
      .from("expense-receipts")
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("expense-receipts").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

async function findIngredient(supabase: any, userId: string, name: string) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;
  const { data } = await supabase
    .from("ingredients")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", cleaned)
    .limit(1)
    .maybeSingle();
  if (data) return data;

  const firstWord = cleaned.split(" ").filter((word) => word.length > 2)[0];
  if (!firstWord) return null;
  const { data: fuzzy } = await supabase
    .from("ingredients")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", `%${firstWord}%`)
    .limit(1)
    .maybeSingle();
  return fuzzy || null;
}

async function analyzeInvoice(supabase: any, userId: string, body: any) {
  const mimeType = String(body.mimeType || body.mime_type || "image/jpeg");
  const fileBase64 = String(body.fileBase64 || body.file_base64 || "").replace(/^data:[^,]+,/, "");
  if (!fileBase64) throw new Error("Envie uma imagem ou PDF da nota.");

  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  const geminiModel = Deno.env.get("GEMINI_VISION_MODEL") || Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const openAiModel = Deno.env.get("OPENAI_VISION_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  if (!geminiKey && !openAiKey) throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para processar notas com IA.");
  if (!geminiKey && mimeType.includes("pdf")) {
    throw new Error("PDF exige GEMINI_API_KEY nesta versão. Para testar agora, envie uma foto JPG/PNG da nota.");
  }

  const [{ data: ingredients }, receiptUrl] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, category, subcategory, unit, cost_price, price, current_stock")
      .eq("user_id", userId)
      .limit(300),
    uploadReceipt(supabase, userId, fileBase64, mimeType),
  ]);

  const knownCatalog = (ingredients || []).map((item: any) => ({
    name: item.name,
    category: item.category || "Insumos",
    subcategory: item.subcategory || "",
    unit: item.unit || "un",
  }));

  const system = [
    "Voce e um especialista em compras, estoque e restaurantes no Brasil.",
    "Extraia a nota fiscal/cupom/recibo da imagem e classifique os itens para um sistema de restaurante.",
    "Nunca invente item que nao esteja na nota. Se tiver duvida, use confidence baixo.",
    "Crie categoria/subcategoria coerente quando nao existir no catalogo. Para acaiteria, exemplos: Complementos/Toppings naturais, Complementos/Confeitos, Frutas, Caldas, Embalagens, Bebidas, Limpeza, Operacional.",
    "Retorne somente JSON valido.",
  ].join("\n");

  const userPrompt = [
    "Catalogo atual de insumos do restaurante:",
    JSON.stringify(knownCatalog).slice(0, 18000),
    "",
    "Responda neste formato:",
    `{
  "supplier_name": "Fornecedor",
  "supplier_document": "CNPJ/CPF se houver",
  "invoice_number": "numero se houver",
  "invoice_date": "YYYY-MM-DD ou vazio",
  "total_amount": 0,
  "expense_category": "insumos",
  "items": [
    {
      "description": "texto original da nota",
      "normalized_name": "nome limpo para estoque",
      "category": "Categoria",
      "subcategory": "Subcategoria",
      "quantity": 1,
      "unit": "un|kg|g|l|ml",
      "unit_price": 0,
      "total_price": 0,
      "stock_unit": "un|kg|g|l|ml",
      "control_stock": true,
      "similar_to": "nome de item parecido do catalogo se houver",
      "confidence": 0.90
    }
  ]
}`,
    "",
    "Regras:",
    "- Para compras de ingredientes/complementos, expense_category deve ser insumos.",
    "- Quantidade e total devem bater com a nota sempre que legivel.",
    "- Se a nota trouxer pacote/fardo/caixa e a unidade real nao for clara, use un.",
    "- control_stock deve ser true para insumos, embalagens e mercadorias controlaveis; false para servicos/taxas/frete.",
  ].join("\n");

  let parsed: any = null;
  if (geminiKey) {
    const ai = await geminiGenerateContent({
      apiKey: geminiKey,
      model: geminiModel,
      system,
      user: "",
      temperature: 0.1,
      responseMimeType: "application/json",
      contents: [{
        role: "user",
        parts: [
          { text: userPrompt },
          { inline_data: { mime_type: mimeType, data: fileBase64 } },
        ],
      }],
    });
    parsed = safeParseJson(ai.text);
  } else {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
            ],
          },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "Erro ao processar imagem com OpenAI.");
    parsed = safeParseJson(data?.choices?.[0]?.message?.content || "");
  }
  if (!parsed || !Array.isArray(parsed.items)) throw new Error("A IA nao conseguiu ler itens validos da nota.");

  const aiItems = parsed.items.map((item: any) => {
    const total = numberValue(item.total_price);
    const quantity = Math.max(0.001, numberValue(item.quantity, 1));
    return {
      description: String(item.description || item.normalized_name || "Item").trim(),
      normalized_name: cleanName(item.normalized_name || item.description || "Item"),
      category: String(item.category || "Insumos").trim(),
      subcategory: String(item.subcategory || "").trim(),
      quantity,
      unit: normalizeUnit(item.unit),
      stock_unit: normalizeUnit(item.stock_unit || item.unit),
      unit_price: numberValue(item.unit_price, total > 0 ? total / quantity : 0),
      total_price: total || numberValue(item.unit_price) * quantity,
      confidence: Math.max(0, Math.min(1, numberValue(item.confidence, 0.7))),
      similar_to: String(item.similar_to || "").trim() || null,
      control_stock: item.control_stock !== false,
    };
  }).filter((item: any) => item.normalized_name);

  const totalAmount = numberValue(parsed.total_amount, aiItems.reduce((sum: number, item: any) => sum + Number(item.total_price || 0), 0));
  const { data: importRow, error: importError } = await supabase
    .from("smart_invoice_imports")
    .insert([{
      user_id: userId,
      source_type: mimeType.includes("pdf") ? "pdf" : "image",
      supplier_name: String(parsed.supplier_name || "").trim() || null,
      supplier_document: onlyDigits(parsed.supplier_document) || null,
      invoice_number: String(parsed.invoice_number || "").trim() || null,
      invoice_date: String(parsed.invoice_date || "").slice(0, 10) || todayIso(),
      total_amount: totalAmount,
      expense_category: String(parsed.expense_category || "insumos").trim() || "insumos",
      receipt_url: receiptUrl,
      raw_ai_response: parsed,
    }])
    .select("*")
    .single();
  if (importError) throw importError;

  const rows = aiItems.map((item: any) => ({
    ...item,
    import_id: importRow.id,
    user_id: userId,
  }));
  const { data: insertedItems, error: itemError } = await supabase
    .from("smart_invoice_import_items")
    .insert(rows)
    .select("*");
  if (itemError) throw itemError;

  return json({ ok: true, import: importRow, items: insertedItems || [] });
}

async function commitInvoice(supabase: any, userId: string, body: any) {
  const importId = String(body.importId || body.import_id || "");
  if (!importId) throw new Error("Importacao nao informada.");
  const launchExpense = body.launchExpense !== false;
  const launchStock = body.launchStock !== false;
  const reviewedItems = Array.isArray(body.items) ? body.items : [];

  const { data: importRow, error: importError } = await supabase
    .from("smart_invoice_imports")
    .select("*")
    .eq("id", importId)
    .eq("user_id", userId)
    .maybeSingle();
  if (importError) throw importError;
  if (!importRow) throw new Error("Importacao nao encontrada.");
  if (importRow.status === "committed") throw new Error("Esta nota ja foi lancada.");

  const { data: dbItems, error: itemsError } = await supabase
    .from("smart_invoice_import_items")
    .select("*")
    .eq("import_id", importId)
    .eq("user_id", userId);
  if (itemsError) throw itemsError;

  const itemById = new Map((dbItems || []).map((item: any) => [String(item.id), item]));
  const items = (reviewedItems.length > 0 ? reviewedItems : dbItems || []).map((item: any) => {
    const base = item.id ? itemById.get(String(item.id)) || {} : {};
    const merged = { ...base, ...item };
    const quantity = Math.max(0.001, numberValue(merged.quantity, 1));
    const total = numberValue(merged.total_price, numberValue(merged.unit_price) * quantity);
    return {
      ...merged,
      description: String(merged.description || merged.normalized_name || "Item").trim(),
      normalized_name: cleanName(merged.normalized_name || merged.description || "Item"),
      category: String(merged.category || "Insumos").trim(),
      subcategory: String(merged.subcategory || "").trim(),
      quantity,
      unit: normalizeUnit(merged.unit),
      stock_unit: normalizeUnit(merged.stock_unit || merged.unit),
      unit_price: numberValue(merged.unit_price, total / quantity),
      total_price: total,
      control_stock: merged.control_stock !== false,
    };
  }).filter((item: any) => item.normalized_name);

  const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.total_price || 0), 0) || Number(importRow.total_amount || 0);
  let expenseId = importRow.expense_id || null;
  if (launchExpense) {
    const description = [
      "Nota de compra",
      importRow.supplier_name ? `- ${importRow.supplier_name}` : "",
      importRow.invoice_number ? `NF ${importRow.invoice_number}` : "",
    ].filter(Boolean).join(" ");
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert([{
        user_id: userId,
        description,
        amount: totalAmount,
        category: importRow.expense_category || "insumos",
        expense_date: importRow.invoice_date || todayIso(),
        receipt_url: importRow.receipt_url,
      }])
      .select("id")
      .single();
    if (expenseError) throw expenseError;
    expenseId = expense.id;
  }

  const stockResults: any[] = [];
  if (launchStock) {
    for (const item of items) {
      if (!item.control_stock) continue;
      let ingredient = await findIngredient(supabase, userId, item.normalized_name);
      if (!ingredient) {
        const { data: created, error: createError } = await supabase
          .from("ingredients")
          .insert([{
            user_id: userId,
            name: item.normalized_name,
            category: item.category || "Insumos",
            subcategory: item.subcategory || null,
            unit: item.stock_unit || item.unit || "un",
            cost_price: item.unit_price || 0,
            price: item.unit_price || 0,
            current_stock: 0,
            min_stock: 0,
            stock_controlled: true,
            is_active: true,
          }])
          .select("*")
          .single();
        if (createError) throw createError;
        ingredient = created;
      } else {
        await supabase
          .from("ingredients")
          .update({
            category: item.category || ingredient.category || "Insumos",
            subcategory: item.subcategory || ingredient.subcategory || null,
            unit: item.stock_unit || ingredient.unit || "un",
            cost_price: item.unit_price || ingredient.cost_price || ingredient.price || 0,
            price: item.unit_price || ingredient.price || ingredient.cost_price || 0,
            stock_controlled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ingredient.id)
          .eq("user_id", userId);
      }

      const nextStock = numberValue(ingredient.current_stock) + numberValue(item.quantity);
      const { error: updateStockError } = await supabase
        .from("ingredients")
        .update({ current_stock: nextStock, updated_at: new Date().toISOString() })
        .eq("id", ingredient.id)
        .eq("user_id", userId);
      if (updateStockError) throw updateStockError;

      await supabase.from("stock_movements").insert([{
        user_id: userId,
        ingredient_id: ingredient.id,
        movement_type: "in",
        quantity: item.quantity,
        unit_cost: item.unit_price || 0,
        reason: `Entrada por nota ${importRow.invoice_number || importRow.id}`,
      }]);

      if (item.id) {
        await supabase
          .from("smart_invoice_import_items")
          .update({
            ingredient_id: ingredient.id,
            description: item.description,
            normalized_name: item.normalized_name,
            category: item.category,
            subcategory: item.subcategory || null,
            quantity: item.quantity,
            unit: item.unit,
            stock_unit: item.stock_unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
            control_stock: item.control_stock,
          })
          .eq("id", item.id)
          .eq("user_id", userId);
      }
      stockResults.push({ item: item.normalized_name, ingredient_id: ingredient.id, quantity: item.quantity });
    }
  }

  const { error: doneError } = await supabase
    .from("smart_invoice_imports")
    .update({ status: "committed", expense_id: expenseId, total_amount: totalAmount, updated_at: new Date().toISOString() })
    .eq("id", importId)
    .eq("user_id", userId);
  if (doneError) throw doneError;

  return json({ ok: true, expense_id: expenseId, stock: stockResults, total_amount: totalAmount });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header is required");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authorization token");

    const body = await req.json().catch(() => ({}));
    const operation = String(body.operation || "analyze");
    if (operation === "analyze") return await analyzeInvoice(supabase, user.id, body);
    if (operation === "commit") return await commitInvoice(supabase, user.id, body);
    throw new Error("Operacao nao suportada.");
  } catch (error) {
    console.error("smart-invoice-import error:", error);
    return json({ ok: false, error: error?.message || "Erro interno" }, 400);
  }
});
