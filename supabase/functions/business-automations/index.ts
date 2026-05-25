// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

type Operation = "send_time_clock_monthly_report" | "send_nfce_xml_monthly" | "run_due_monthly_automations";

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvEscape(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return /[",\n;]/.test(text) ? `"${text}"` : text;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function currentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end, label: `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}` };
}

function previousMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end, label: `${String(start.getMonth() + 1).padStart(2, "0")}/${start.getFullYear()}` };
}

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return {
      sent: false,
      status: "skipped",
      message: "Provedor de email nao configurado. Configure RESEND_API_KEY nos secrets da Supabase.",
      providerId: null,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "PopSystem <noreply@boracume.com>",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments || [],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || "Nao foi possivel enviar o email.");
  }
  return {
    sent: true,
    status: "sent",
    message: "Email enviado com sucesso.",
    providerId: body?.id || null,
  };
}

async function loadProfileEmail(supabase: any, userId: string, fallbackEmail?: string | null) {
  const { data } = await supabase
    .from("profiles")
    .select("email, restaurant_name")
    .eq("id", userId)
    .maybeSingle();
  return {
    email: data?.email || fallbackEmail || "",
    restaurantName: data?.restaurant_name || "PopSystem PDV",
  };
}

async function loadAutomationSettings(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("business_email_automation_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    hr_email: "",
    accounting_email: "",
    send_time_clock_monthly: true,
    send_nfce_xml_monthly: true,
    report_day: 1,
    ...(data || {}),
  };
}

async function insertLog(supabase: any, log: Record<string, unknown>) {
  await supabase.from("business_email_automation_logs").insert([log]);
}

async function sendTimeClockReport(supabase: any, userId: string, userEmail?: string | null, mode = "manual") {
  const settings = await loadAutomationSettings(supabase, userId);
  const profile = await loadProfileEmail(supabase, userId, userEmail);
  const recipient = String(settings.hr_email || profile.email || "").trim();
  if (!recipient) throw new Error("Informe o email do RH ou o email do estabelecimento para enviar o relatorio.");

  const period = mode === "due" ? previousMonthPeriod() : currentMonthPeriod();
  const { data: events, error } = await supabase
    .from("employee_time_clock_events")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_at", period.start.toISOString())
    .lte("occurred_at", period.end.toISOString())
    .order("occurred_at", { ascending: true });
  if (error) throw error;

  const waiterIds = Array.from(new Set((events || []).map((event: any) => event.waiter_id).filter(Boolean)));
  let waiters = new Map<string, any>();
  if (waiterIds.length > 0) {
    const { data: waiterRows, error: waiterError } = await supabase
      .from("waiters")
      .select("id, name, role, email, cpf")
      .eq("user_id", userId)
      .in("id", waiterIds);
    if (waiterError) throw waiterError;
    waiters = new Map((waiterRows || []).map((waiter: any) => [waiter.id, waiter]));
  }

  const labels: Record<string, string> = {
    clock_in: "Entrada",
    break_start: "Inicio intervalo",
    break_end: "Retorno intervalo",
    clock_out: "Saida",
  };
  const csvLines = [
    ["Funcionario", "Cargo", "Email", "CPF", "Evento", "Status", "Horario", "Distancia", "Dentro do raio", "Facial", "Observacao"].map(csvEscape).join(";"),
    ...(events || []).map((event: any) => {
      const waiter = waiters.get(event.waiter_id) || {};
      return [
        waiter.name || "Funcionario",
        waiter.role || "",
        waiter.email || "",
        waiter.cpf || "",
        labels[event.event_type] || event.event_type,
        event.status || "",
        formatDateTime(event.occurred_at),
        event.distance_meters == null ? "" : `${Math.round(Number(event.distance_meters))}m`,
        event.within_geofence === null || event.within_geofence === undefined ? "" : event.within_geofence ? "Sim" : "Nao",
        event.face_status || "",
        event.review_reason || "",
      ].map(csvEscape).join(";");
    }),
  ];
  const approvedCount = (events || []).filter((event: any) => event.status === "approved").length;
  const pendingCount = (events || []).filter((event: any) => event.status === "pending_review").length;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#063b2a">
      <h2>Relatorio mensal de ponto - ${htmlEscape(profile.restaurantName)}</h2>
      <p>Periodo: ${period.start.toLocaleDateString("pt-BR")} a ${period.end.toLocaleDateString("pt-BR")}</p>
      <p><strong>Total de registros:</strong> ${(events || []).length}</p>
      <p><strong>Aprovados:</strong> ${approvedCount} | <strong>Em revisao:</strong> ${pendingCount}</p>
      <p>O arquivo CSV em anexo pode ser importado ou enviado ao RH para conferencia.</p>
    </div>
  `;

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Relatorio de ponto ${period.label} - ${profile.restaurantName}`,
    html,
    attachments: [{
      filename: `relatorio-ponto-${period.label.replace("/", "-")}.csv`,
      content: encodeBase64Utf8(csvLines.join("\n")),
    }],
  });

  await insertLog(supabase, {
    user_id: userId,
    automation_type: "time_clock_monthly_report",
    period_start: period.start.toISOString().slice(0, 10),
    period_end: period.end.toISOString().slice(0, 10),
    recipient_email: recipient,
    status: emailResult.status,
    message: emailResult.message,
    provider_message_id: emailResult.providerId,
    metadata: { count: (events || []).length, mode },
  });

  return {
    message: emailResult.sent
      ? `Relatorio de ponto enviado para ${recipient}.`
      : emailResult.message,
    count: (events || []).length,
  };
}

async function sendNfceXmlEmail(supabase: any, userId: string, userEmail?: string | null, mode = "manual") {
  const settings = await loadAutomationSettings(supabase, userId);
  const profile = await loadProfileEmail(supabase, userId, userEmail);
  const recipient = String(settings.accounting_email || "").trim();
  if (!recipient) throw new Error("Informe o email da contabilidade para enviar os XMLs.");

  const period = mode === "due" ? previousMonthPeriod() : currentMonthPeriod();
  const { data: cupons, error } = await supabase
    .from("nfce_cupons")
    .select("id, numero, serie, chave_acesso, status, valor_total, data_hora_emissao, created_at, xml_autorizado, xml_content")
    .eq("user_id", userId)
    .gte("created_at", period.start.toISOString())
    .lte("created_at", period.end.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const xmlCupons = (cupons || []).filter((cupom: any) => cupom.xml_autorizado || cupom.xml_content);
  const attachments = xmlCupons.slice(0, 80).map((cupom: any) => ({
    filename: `nfce-${cupom.serie || "1"}-${cupom.numero || cupom.id}.xml`,
    content: encodeBase64Utf8(cupom.xml_autorizado || cupom.xml_content),
  }));
  const total = xmlCupons.reduce((sum: number, cupom: any) => sum + Number(cupom.valor_total || 0), 0);
  const html = `
    <div style="font-family:Arial,sans-serif;color:#063b2a">
      <h2>XML NFC-e mensal - ${htmlEscape(profile.restaurantName)}</h2>
      <p>Periodo: ${period.start.toLocaleDateString("pt-BR")} a ${period.end.toLocaleDateString("pt-BR")}</p>
      <p><strong>XMLs encontrados:</strong> ${xmlCupons.length}</p>
      <p><strong>Total fiscal registrado:</strong> ${formatMoney(total)}</p>
      ${xmlCupons.length > attachments.length ? `<p>Foram anexados os primeiros ${attachments.length} XMLs. Gere novamente em lote menor para o restante.</p>` : ""}
    </div>
  `;

  const emailResult = await sendEmail({
    to: recipient,
    subject: `XML NFC-e ${period.label} - ${profile.restaurantName}`,
    html,
    attachments,
  });

  await insertLog(supabase, {
    user_id: userId,
    automation_type: "nfce_xml_monthly",
    period_start: period.start.toISOString().slice(0, 10),
    period_end: period.end.toISOString().slice(0, 10),
    recipient_email: recipient,
    status: emailResult.status,
    message: emailResult.message,
    provider_message_id: emailResult.providerId,
    metadata: { count: xmlCupons.length, attached: attachments.length, mode },
  });

  return {
    message: emailResult.sent
      ? `${attachments.length} XML(s) enviados para ${recipient}.`
      : emailResult.message,
    count: xmlCupons.length,
  };
}

async function runDueMonthlyAutomations(supabase: any) {
  const now = new Date();
  const day = now.getDate();
  const period = previousMonthPeriod();
  const periodKey = `${period.start.getFullYear()}-${String(period.start.getMonth() + 1).padStart(2, "0")}`;
  const { data: settings, error } = await supabase
    .from("business_email_automation_settings")
    .select("*")
    .eq("report_day", Math.min(day, 28));
  if (error) throw error;

  const results: any[] = [];
  for (const row of settings || []) {
    const { data: userData } = await supabase.auth.admin.getUserById(row.user_id);
    if (row.send_time_clock_monthly && row.last_time_clock_report_month !== periodKey) {
      results.push(await sendTimeClockReport(supabase, row.user_id, userData?.user?.email || null, "due"));
      await supabase.from("business_email_automation_settings").update({ last_time_clock_report_month: periodKey }).eq("user_id", row.user_id);
    }
    if (row.send_nfce_xml_monthly && row.last_nfce_xml_month !== periodKey) {
      results.push(await sendNfceXmlEmail(supabase, row.user_id, userData?.user?.email || null, "due"));
      await supabase.from("business_email_automation_settings").update({ last_nfce_xml_month: periodKey }).eq("user_id", row.user_id);
    }
  }
  return { message: `Automacoes processadas: ${results.length}.`, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const body = await req.json().catch(() => ({}));
    const operation = String(body.operation || "") as Operation;
    if (!operation) throw new Error("Operacao nao informada.");

    if (operation === "run_due_monthly_automations") {
      const secret = Deno.env.get("AUTOMATION_SECRET");
      if (secret && req.headers.get("x-automation-secret") !== secret) throw new Error("Automacao nao autorizada.");
      const result = await runDueMonthlyAutomations(supabase);
      return json({ ok: true, ...result });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header is required");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authorization token");

    if (operation === "send_time_clock_monthly_report") {
      const result = await sendTimeClockReport(supabase, user.id, user.email, String(body.mode || "manual"));
      return json({ ok: true, ...result });
    }
    if (operation === "send_nfce_xml_monthly") {
      const result = await sendNfceXmlEmail(supabase, user.id, user.email, String(body.mode || "manual"));
      return json({ ok: true, ...result });
    }
    throw new Error("Operacao nao suportada.");
  } catch (error) {
    console.error("Error in business-automations:", error);
    return json({ ok: false, error: error?.message || "Erro interno do servidor" }, 400);
  }
});
