import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanConfig = {
  id: number;
  name: string;
  price: number;
  includedStores: number;
  extraStorePrice: number;
};

const fallbackPlans: Record<number, PlanConfig> = {
  1: { id: 1, name: "Essencial", price: 159, includedStores: 1, extraStorePrice: 0 },
  2: { id: 2, name: "Pro", price: 229, includedStores: 1, extraStorePrice: 0 },
  3: { id: 3, name: "Multi", price: 269, includedStores: 1, extraStorePrice: 149 },
};

const money = (value: unknown) => Number(Number(value || 0).toFixed(2));

const onlyDigits = (value: unknown) => String(value || "").replace(/\D/g, "");

const normalizeCpfCnpj = (value: unknown) => {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14 ? digits : null;
};

const isBillingDocumentError = (message: string) => /cpf|cnpj/i.test(message);

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const getAsaasBaseUrl = () => {
  const env = (Deno.env.get("ASAAS_ENVIRONMENT") || "production").toLowerCase();
  return env === "sandbox" || env === "homologacao" || env === "homologação"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
};

const asaasFetch = async (path: string, init: RequestInit = {}) => {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada no Supabase.");

  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.errors
      ?.map((item: { description?: string; message?: string }) => item.description || item.message)
      .filter(Boolean)
      .join(" | ") || data?.message || `Asaas respondeu HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Não foi possível confirmar o usuário logado.");
    }

    const user = userData.user;
    const body = await req.json().catch(() => ({}));
    const planId = Number(body.planId || 2);
    const storeCount = Math.max(1, Number(body.storeCount || 1));
    const metadata = (user.user_metadata || {}) as Record<string, unknown>;

    const { data: fiscalSettings } = await supabaseAdmin
      .from("fiscal_settings")
      .select("cnpj,razao_social,nome_fantasia")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerName = String(
      fiscalSettings?.razao_social ||
      fiscalSettings?.nome_fantasia ||
      metadata.full_name ||
      metadata.name ||
      user.email ||
      "Cliente PopSystem"
    );

    const billingDocument =
      normalizeCpfCnpj(body.billingDocument || body.cpfCnpj || body.document || body.cpf_cnpj || body.cnpj || body.cpf) ||
      normalizeCpfCnpj(metadata.cpfCnpj || metadata.cpf_cnpj || metadata.document || metadata.cnpj || metadata.cpf) ||
      normalizeCpfCnpj(fiscalSettings?.cnpj);

    const { data: planRow } = await supabaseAdmin
      .from("subscription_plans")
      .select("id,name,price,included_stores,extra_store_price")
      .eq("id", planId)
      .maybeSingle();

    const fallback = fallbackPlans[planId] || fallbackPlans[2];
    const plan: PlanConfig = {
      id: Number(planRow?.id || fallback.id),
      name: String(planRow?.name || fallback.name),
      price: money(planRow?.price ?? fallback.price),
      includedStores: Number(planRow?.included_stores || fallback.includedStores),
      extraStorePrice: money(planRow?.extra_store_price ?? fallback.extraStorePrice),
    };

    const additionalStoreCount = Math.max(0, storeCount - plan.includedStores);
    const value = money(plan.price + additionalStoreCount * plan.extraStorePrice);

    const { data: existingSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id,asaas_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingSubscription?.asaas_customer_id || null;

    if (!billingDocument) {
      throw new Error("Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente.");
    }

    if (!customerId) {
      const customer = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: user.email,
          cpfCnpj: billingDocument,
          externalReference: user.id,
        }),
      });
      customerId = customer.id;
    } else {
      await asaasFetch(`/customers/${encodeURIComponent(customerId)}`, {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: user.email,
          cpfCnpj: billingDocument,
        }),
      }).catch((updateError) => {
        console.warn("Não foi possível atualizar o cliente no Asaas:", updateError);
      });
    }

    const billingType = String(body.billingType || Deno.env.get("ASAAS_BILLING_TYPE") || "UNDEFINED").toUpperCase();
    const dueDays = Math.max(0, Number(Deno.env.get("ASAAS_DUE_DAYS") || 1));
    const nextDueDate = String(body.nextDueDate || addDays(dueDays));

    const asaasSubscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value,
        nextDueDate,
        cycle: "MONTHLY",
        description: `PopSystem ${plan.name}${plan.id === 3 ? ` - ${storeCount} loja(s)` : ""}`,
        externalReference: `${user.id}:${plan.id}:${Date.now()}`,
      }),
    });

    const payments = await asaasFetch(`/payments?subscription=${encodeURIComponent(asaasSubscription.id)}&limit=1`);
    const payment = Array.isArray(payments?.data) ? payments.data[0] : null;
    const paymentUrl = payment?.invoiceUrl || payment?.bankSlipUrl || asaasSubscription?.invoiceUrl || null;

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const subscriptionPayload = {
      user_id: user.id,
      plan_id: plan.id,
      status: "pending",
      billing_provider: "asaas",
      asaas_customer_id: customerId,
      asaas_subscription_id: asaasSubscription.id,
      asaas_payment_id: payment?.id || null,
      store_count: storeCount,
      additional_store_count: additionalStoreCount,
      extra_store_price: plan.extraStorePrice,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: subscriptionError } = existingSubscription?.id
      ? await supabaseAdmin.from("subscriptions").update(subscriptionPayload).eq("id", existingSubscription.id)
      : await supabaseAdmin.from("subscriptions").insert(subscriptionPayload);

    if (subscriptionError) {
      throw new Error(`Cobrança criada no Asaas, mas falhou ao salvar no PopSystem: ${subscriptionError.message}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      provider: "asaas",
      customerId,
      subscriptionId: asaasSubscription.id,
      paymentId: payment?.id || null,
      value,
      paymentUrl,
      invoiceUrl: paymentUrl,
      status: payment?.status || asaasSubscription?.status || "PENDING",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-asaas-subscription error:", error);
    const message = error instanceof Error ? error.message : "Erro ao criar cobrança no Asaas.";
    return new Response(JSON.stringify({
      ok: false,
      error: message,
      message,
      needsBillingDocument: isBillingDocumentError(message),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
