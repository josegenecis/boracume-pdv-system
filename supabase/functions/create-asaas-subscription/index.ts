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

type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "yearly";

const billingPeriods: Record<BillingPeriod, {
  months: number;
  discountPercent: number;
  cycle: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  label: string;
}> = {
  monthly: { months: 1, discountPercent: 0, cycle: "MONTHLY", label: "mensal" },
  quarterly: { months: 3, discountPercent: 10, cycle: "QUARTERLY", label: "trimestral" },
  semiannual: { months: 6, discountPercent: 15, cycle: "SEMIANNUALLY", label: "semestral" },
  yearly: { months: 12, discountPercent: 20, cycle: "YEARLY", label: "anual" },
};

const fallbackPlans: Record<number, PlanConfig> = {
  1: { id: 1, name: "Essencial", price: 159, includedStores: 1, extraStorePrice: 0 },
  2: { id: 2, name: "Pro", price: 229, includedStores: 1, extraStorePrice: 0 },
  3: { id: 3, name: "Multi", price: 269, includedStores: 1, extraStorePrice: 149 },
};

const money = (value: unknown) => Number(Number(value || 0).toFixed(2));

const onlyDigits = (value: unknown) => String(value || "").replace(/\D/g, "");

const today = () => new Date().toISOString().slice(0, 10);

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

const normalizeCpfCnpj = (value: unknown) => {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14 ? digits : null;
};

const isBillingDocumentError = (message: string) => /cpf|cnpj/i.test(message);

const isRemovedCustomerError = (message: string) =>
  /cliente removido|customer.*(removed|deleted)|deleted customer/i.test(message);

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
    const billingPeriodKey = String(body.billingPeriod || "monthly").toLowerCase() as BillingPeriod;
    const billingPeriod = billingPeriods[billingPeriodKey];
    if (!billingPeriod) {
      throw new Error("Período de cobrança inválido.");
    }
    const paymentMethod = String(body.paymentMethod || "PIX").toUpperCase();
    if (!new Set(["PIX", "CREDIT_CARD"]).has(paymentMethod)) {
      throw new Error("Forma de pagamento inválida. Escolha PIX ou cartão de crédito.");
    }
    const metadata = (user.user_metadata || {}) as Record<string, unknown>;

    const { data: fiscalSettings } = await supabaseAdmin
      .from("fiscal_settings")
      .select("cnpj,razao_social,nome_fantasia,endereco_cep,endereco_numero,endereco_complemento")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
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
    const monthlyValue = money(plan.price + additionalStoreCount * plan.extraStorePrice);
    const grossPeriodValue = money(monthlyValue * billingPeriod.months);
    const value = money(grossPeriodValue * (1 - billingPeriod.discountPercent / 100));

    const { data: existingSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id,plan_id,status,store_count,current_period_start,current_period_end,asaas_customer_id,asaas_subscription_id,billing_cycle,billing_months,billing_discount_percent,billing_amount")
      .eq("user_id", user.id)
      .maybeSingle();

    let oldMonthlyValue = 0;
    if (existingSubscription?.plan_id) {
      const { data: oldPlanRow } = await supabaseAdmin
        .from("subscription_plans")
        .select("price,included_stores,extra_store_price")
        .eq("id", existingSubscription.plan_id)
        .maybeSingle();
      const oldFallback = fallbackPlans[Number(existingSubscription.plan_id)] || fallbackPlans[1];
      const oldStoreCount = Math.max(1, Number(existingSubscription.store_count || 1));
      const oldIncludedStores = Number(oldPlanRow?.included_stores || oldFallback.includedStores);
      const oldExtraStores = Math.max(0, oldStoreCount - oldIncludedStores);
      oldMonthlyValue = money(
        Number(oldPlanRow?.price ?? oldFallback.price) +
        oldExtraStores * Number(oldPlanRow?.extra_store_price ?? oldFallback.extraStorePrice),
      );
    }

    const oldBillingMonths = Math.max(1, Number(existingSubscription?.billing_months || 1));
    const oldBillingCycle = String(existingSubscription?.billing_cycle || "MONTHLY");
    const oldBillingAmount = money(existingSubscription?.billing_amount || oldMonthlyValue * oldBillingMonths);

    const periodStartDate = existingSubscription?.current_period_start
      ? new Date(existingSubscription.current_period_start)
      : null;
    const periodEndDate = existingSubscription?.current_period_end
      ? new Date(existingSubscription.current_period_end)
      : null;
    const now = new Date();
    const hasValidActivePeriod = existingSubscription?.status === "active"
      && periodStartDate && periodEndDate
      && Number.isFinite(periodStartDate.getTime())
      && Number.isFinite(periodEndDate.getTime())
      && periodEndDate.getTime() > now.getTime();
    const subscriptionConfigChanged = Boolean(
      hasValidActivePeriod
      && (
        Number(existingSubscription?.plan_id) !== plan.id
        || Number(existingSubscription?.store_count || 1) !== storeCount
        || oldBillingCycle !== billingPeriod.cycle
      )
    );
    if (hasValidActivePeriod && !subscriptionConfigChanged) {
      throw new Error("Este plano e período já estão ativos na sua conta.");
    }
    const isPlanOrStoreUpgrade = monthlyValue > oldMonthlyValue;
    const isLongerCommitment = Number(existingSubscription?.plan_id) === plan.id
      && Number(existingSubscription?.store_count || 1) === storeCount
      && billingPeriod.months > oldBillingMonths;
    const isUpgrade = subscriptionConfigChanged && (isPlanOrStoreUpgrade || isLongerCommitment);
    if (subscriptionConfigChanged && !isUpgrade) {
      throw new Error("Reduções de plano ou de período são aplicadas no próximo vencimento. Fale com o suporte para programar esta alteração sem perder saldo.");
    }
    const periodMs = hasValidActivePeriod
      ? Math.max(1, periodEndDate!.getTime() - periodStartDate!.getTime())
      : 30 * 24 * 60 * 60 * 1000;
    const remainingMs = hasValidActivePeriod
      ? Math.max(0, periodEndDate!.getTime() - now.getTime())
      : 0;
    const creditAmount = isUpgrade ? money(oldBillingAmount * (remainingMs / periodMs)) : 0;
    if (isUpgrade && creditAmount >= value) {
      throw new Error("O saldo do plano atual cobre integralmente o novo período. Fale com o suporte para transferirmos esse saldo sem gerar cobrança simbólica.");
    }
    const chargeValue = isUpgrade ? money(Math.max(0.01, value - creditAmount)) : value;

    let customerId = existingSubscription?.asaas_customer_id || null;

    if (!billingDocument) {
      throw new Error("Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente.");
    }

    const createCustomer = async () => {
      const customer = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: user.email,
          cpfCnpj: billingDocument,
          externalReference: user.id,
        }),
      });
      return customer.id as string;
    };

    if (!customerId) {
      customerId = await createCustomer();
    } else {
      try {
        await asaasFetch(`/customers/${encodeURIComponent(customerId)}`, {
          method: "POST",
          body: JSON.stringify({
            name: customerName,
            email: user.email,
            cpfCnpj: billingDocument,
          }),
        });
      } catch (updateError) {
        const updateMessage = updateError instanceof Error ? updateError.message : String(updateError);
        if (isRemovedCustomerError(updateMessage)) {
          console.warn("Cliente anterior foi removido no Asaas; criando um novo cadastro.");
          customerId = await createCustomer();
        } else {
          console.warn("Não foi possível atualizar o cliente no Asaas:", updateError);
        }
      }
    }

    const billingType = paymentMethod;
    const renewalDate = addMonths(new Date(), billingPeriod.months);
    const nextDueDate = String(body.nextDueDate || (isUpgrade ? renewalDate.toISOString().slice(0, 10) : today()));

    const creditCard = paymentMethod === "CREDIT_CARD" ? {
      holderName: String(body.creditCard?.holderName || "").trim(),
      number: onlyDigits(body.creditCard?.number),
      expiryMonth: onlyDigits(body.creditCard?.expiryMonth).padStart(2, "0"),
      expiryYear: onlyDigits(body.creditCard?.expiryYear),
      ccv: onlyDigits(body.creditCard?.ccv),
    } : null;

    const creditCardHolderInfo = paymentMethod === "CREDIT_CARD" ? {
      name: String(body.creditCardHolderInfo?.name || creditCard?.holderName || customerName).trim(),
      email: String(body.creditCardHolderInfo?.email || user.email || "").trim(),
      cpfCnpj: normalizeCpfCnpj(body.creditCardHolderInfo?.cpfCnpj) || billingDocument,
      postalCode: onlyDigits(body.creditCardHolderInfo?.postalCode || fiscalSettings?.endereco_cep),
      addressNumber: String(body.creditCardHolderInfo?.addressNumber || fiscalSettings?.endereco_numero || "").trim(),
      addressComplement: String(body.creditCardHolderInfo?.addressComplement || fiscalSettings?.endereco_complemento || "").trim() || null,
      mobilePhone: onlyDigits(body.creditCardHolderInfo?.mobilePhone || profile?.phone),
    } : null;

    if (creditCard) {
      if (creditCard.number.length < 13 || creditCard.number.length > 19) throw new Error("Número do cartão inválido.");
      if (!creditCard.holderName) throw new Error("Informe o nome impresso no cartão.");
      if (!/^(0[1-9]|1[0-2])$/.test(creditCard.expiryMonth) || creditCard.expiryYear.length !== 4) {
        throw new Error("Validade do cartão inválida.");
      }
      if (creditCard.ccv.length < 3 || creditCard.ccv.length > 4) throw new Error("Código de segurança inválido.");
      if (!creditCardHolderInfo?.postalCode || !creditCardHolderInfo.addressNumber || !creditCardHolderInfo.mobilePhone) {
        throw new Error("Informe CEP, número do endereço e celular do titular do cartão.");
      }
    }

    const createSubscription = () => asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value,
        nextDueDate,
        cycle: billingPeriod.cycle,
        description: `PopSystem ${plan.name} - plano ${billingPeriod.label}${plan.id === 3 ? ` - ${storeCount} loja(s)` : ""}`,
        externalReference: `${user.id}:${plan.id}:${billingPeriod.cycle}:${Date.now()}`,
        ...(creditCard ? { creditCard, creditCardHolderInfo } : {}),
      }),
    });

    let asaasSubscription;
    try {
      asaasSubscription = await createSubscription();
    } catch (subscriptionError) {
      const subscriptionMessage = subscriptionError instanceof Error
        ? subscriptionError.message
        : String(subscriptionError);
      if (!isRemovedCustomerError(subscriptionMessage)) throw subscriptionError;

      console.warn("Cliente foi removido no Asaas durante a cobrança; recriando o cadastro.");
      customerId = await createCustomer();
      asaasSubscription = await createSubscription();
    }

    let payment = null;
    let planChangeId: string | null = null;

    if (isUpgrade) {
      const { data: planChange, error: planChangeError } = await supabaseAdmin
        .from("subscription_plan_changes")
        .insert({
          user_id: user.id,
          from_plan_id: existingSubscription!.plan_id,
          to_plan_id: plan.id,
          from_store_count: Number(existingSubscription!.store_count || 1),
          to_store_count: storeCount,
          old_monthly_value: oldMonthlyValue,
          new_monthly_value: monthlyValue,
          from_billing_cycle: oldBillingCycle,
          to_billing_cycle: billingPeriod.cycle,
          from_billing_months: oldBillingMonths,
          to_billing_months: billingPeriod.months,
          from_billing_amount: oldBillingAmount,
          to_billing_amount: value,
          billing_discount_percent: billingPeriod.discountPercent,
          credit_amount: creditAmount,
          charge_amount: chargeValue,
          remaining_days: remainingMs / (24 * 60 * 60 * 1000),
          period_days: periodMs / (24 * 60 * 60 * 1000),
          payment_method: paymentMethod,
          old_asaas_subscription_id: existingSubscription!.asaas_subscription_id,
          new_asaas_customer_id: customerId,
          new_asaas_subscription_id: asaasSubscription.id,
        })
        .select("id")
        .single();
      if (planChangeError || !planChange) {
        throw new Error(`Não foi possível registrar o upgrade: ${planChangeError?.message || "erro desconhecido"}`);
      }
      planChangeId = planChange.id;

      payment = await asaasFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType,
          value: chargeValue,
          dueDate: today(),
          description: `Upgrade PopSystem para ${plan.name} ${billingPeriod.label} - crédito de R$ ${creditAmount.toFixed(2)}`,
          externalReference: `subscription-upgrade:${planChangeId}`,
          ...(creditCard ? { creditCard, creditCardHolderInfo } : {}),
        }),
      });

      const { error: paymentLinkError } = await supabaseAdmin
        .from("subscription_plan_changes")
        .update({ asaas_payment_id: payment.id })
        .eq("id", planChangeId);
      if (paymentLinkError) throw new Error(`Não foi possível vincular a cobrança do upgrade: ${paymentLinkError.message}`);
    } else {
      for (let attempt = 0; attempt < 4 && !payment; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 350));
        const payments = await asaasFetch(`/subscriptions/${encodeURIComponent(asaasSubscription.id)}/payments?limit=1`);
        payment = Array.isArray(payments?.data) ? payments.data[0] : null;
      }
      if (!payment?.id) throw new Error("A assinatura foi criada, mas a primeira cobrança ainda não foi disponibilizada pelo Asaas.");
    }

    const pix = paymentMethod === "PIX" && payment?.id
      ? await asaasFetch(`/payments/${encodeURIComponent(payment.id)}/pixQrCode`)
      : null;

    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, billingPeriod.months);

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
      billing_cycle: billingPeriod.cycle,
      billing_months: billingPeriod.months,
      billing_discount_percent: billingPeriod.discountPercent,
      billing_amount: value,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: subscriptionError } = isUpgrade
      ? { error: null }
      : existingSubscription?.id
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
      value: chargeValue,
      monthlyValue,
      periodValue: value,
      billingPeriod: billingPeriodKey,
      billingCycle: billingPeriod.cycle,
      billingMonths: billingPeriod.months,
      discountPercent: billingPeriod.discountPercent,
      isUpgrade,
      proration: isUpgrade ? {
        oldMonthlyValue,
        newMonthlyValue: monthlyValue,
        newPeriodValue: value,
        creditAmount,
        chargeAmount: chargeValue,
        remainingDays: Number((remainingMs / (24 * 60 * 60 * 1000)).toFixed(2)),
      } : null,
      paymentMethod,
      pix: pix ? {
        encodedImage: pix.encodedImage,
        payload: pix.payload,
        expirationDate: pix.expirationDate,
      } : null,
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
