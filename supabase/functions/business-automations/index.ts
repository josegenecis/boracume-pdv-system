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

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  return encodeBase64Bytes(bytes);
}

function encodeBase64Bytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipFiles(files: Array<{ path: string; content: string | Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const contentBytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, dosTime);
    writeUint16(localHeader, 12, dosDate);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, contentBytes.length);
    writeUint32(localHeader, 22, contentBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, dosTime);
    writeUint16(centralHeader, 14, dosDate);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, contentBytes.length);
    writeUint32(centralHeader, 24, contentBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, contentBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, files.length);
  writeUint16(end, 10, files.length);
  writeUint32(end, 12, centralDirectory.length);
  writeUint32(end, 16, offset);
  writeUint16(end, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sheetXml(rows: unknown[][]) {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${htmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function safeSheetName(value: string, fallback: string) {
  const clean = String(value || fallback).replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim() || fallback;
  return clean.slice(0, 31);
}

function uniqueSheetNames(names: string[]) {
  const used = new Map<string, number>();
  return names.map((name, index) => {
    const base = safeSheetName(name, `Funcionario ${index + 1}`);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    if (count === 0) return base;
    const suffix = ` ${count + 1}`;
    return `${base.slice(0, 31 - suffix.length)}${suffix}`;
  });
}

function createXlsxWorkbook(sheets: Array<{ name: string; rows: unknown[][] }>) {
  const sheetNames = uniqueSheetNames(sheets.map((sheet) => sheet.name));
  const workbookSheets = sheetNames.map((name, index) =>
    `<sheet name="${htmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  const workbookRels = sheetNames.map((_name, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  const contentTypesSheets = sheetNames.map((_name, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  const files = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentTypesSheets}
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}
  <Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet.rows),
    })),
  ];

  return zipFiles(files);
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

const occurrenceLabels: Record<string, string> = {
  vacation: "Ferias",
  medical_certificate: "Atestado",
  paid_leave: "Licenca remunerada",
  day_off: "Folga",
  holiday: "Feriado",
  justified_absence: "Falta justificada",
  unjustified_absence: "Falta nao justificada",
  manual_adjustment: "Ajuste manual",
  suspension: "Suspensao",
  other: "Outro",
};

const weekdayNames = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eachDateKey(start: Date, end: Date) {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getOccurrenceForDate(occurrences: any[], key: string) {
  return occurrences.find((occurrence) => occurrence.start_date <= key && occurrence.end_date >= key && occurrence.status !== "rejected");
}

function buildDailyMirrorRows(params: {
  employeeEvents: any[];
  employeeOccurrences: any[];
  period: { start: Date; end: Date };
  settings: any;
}) {
  const settings = params.settings || {};
  const expectedDaily = Math.max(0, Number(settings.standard_daily_minutes || 480));
  const minimumBreak = Math.max(0, Number(settings.minimum_break_minutes || 60));
  const tolerance = Math.max(0, Number(settings.overtime_tolerance_minutes || 10));
  const workdays = Array.isArray(settings.workdays) && settings.workdays.length > 0 ? settings.workdays : [1, 2, 3, 4, 5, 6];
  const eventsByDate = new Map<string, any[]>();
  for (const event of params.employeeEvents || []) {
    const key = dateKey(new Date(event.occurred_at));
    eventsByDate.set(key, [...(eventsByDate.get(key) || []), event]);
  }

  return eachDateKey(params.period.start, params.period.end).map((key) => {
    const currentDate = parseDateKey(key);
    const weekday = currentDate.getDay();
    const expectedWorkday = workdays.includes(weekday);
    const occurrence = getOccurrenceForDate(params.employeeOccurrences || [], key);
    const dayEvents = (eventsByDate.get(key) || [])
      .filter((event) => event.status !== "rejected")
      .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime());
    const firstIn = dayEvents.find((event) => event.event_type === "clock_in");
    const lastOut = dayEvents.slice().reverse().find((event) => event.event_type === "clock_out");
    const breakStart = dayEvents.find((event) => event.event_type === "break_start");
    const breakEnd = dayEvents.find((event) => event.event_type === "break_end");
    const grossMinutes = minutesBetween(firstIn?.occurred_at, lastOut?.occurred_at);
    const breakMinutes = minutesBetween(breakStart?.occurred_at, breakEnd?.occurred_at);
    const workedMinutes = Math.max(0, grossMinutes - breakMinutes);
    const expectedMinutes = expectedWorkday && !(occurrence?.affects_expected_hours) ? expectedDaily : expectedWorkday && !occurrence ? expectedDaily : 0;
    const balance = workedMinutes - expectedMinutes;
    const overtime = balance > tolerance ? balance : 0;
    const deficit = balance < -tolerance ? Math.abs(balance) : 0;
    const missingPunch = dayEvents.length > 0 && (!firstIn || !lastOut);
    const breakIssue = workedMinutes > expectedDaily && minimumBreak > 0 && breakMinutes < minimumBreak;
    const absence = expectedWorkday && !occurrence && dayEvents.length === 0;
    const pendingReview = dayEvents.some((event) => event.status === "pending_review");
    const alerts = [
      missingPunch ? "Batida incompleta" : "",
      breakIssue ? "Intervalo abaixo do minimo" : "",
      absence ? "Falta sem lancamento" : "",
      pendingReview ? "Ponto em revisao" : "",
    ].filter(Boolean);

    return {
      key,
      date: currentDate.toLocaleDateString("pt-BR"),
      weekday: weekdayNames[weekday],
      expectedWorkday,
      firstIn: firstIn ? formatTime(firstIn.occurred_at) : "",
      breakStart: breakStart ? formatTime(breakStart.occurred_at) : "",
      breakEnd: breakEnd ? formatTime(breakEnd.occurred_at) : "",
      lastOut: lastOut ? formatTime(lastOut.occurred_at) : "",
      workedMinutes,
      breakMinutes,
      expectedMinutes,
      overtime,
      deficit,
      occurrenceLabel: occurrence ? occurrenceLabels[occurrence.occurrence_type] || occurrence.occurrence_type : "",
      occurrenceNotes: occurrence?.notes || "",
      status: alerts.length > 0 ? alerts.join("; ") : occurrence ? "Ocorrencia aprovada" : dayEvents.length > 0 ? "Ok" : expectedWorkday ? "Sem batida" : "Nao previsto",
    };
  });
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
      "User-Agent": "PopSystem-Business-Automations/1.0",
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

  const { data: occurrences, error: occurrenceError } = await supabase
    .from("employee_time_clock_occurrences")
    .select("*")
    .eq("user_id", userId)
    .lte("start_date", period.end.toISOString().slice(0, 10))
    .gte("end_date", period.start.toISOString().slice(0, 10))
    .order("start_date", { ascending: true });
  if (occurrenceError) throw occurrenceError;

  const waiterIds = Array.from(new Set([
    ...(events || []).map((event: any) => event.waiter_id).filter(Boolean),
    ...(occurrences || []).map((occurrence: any) => occurrence.waiter_id).filter(Boolean),
  ]));
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
  const headers = ["Funcionario", "Cargo", "Email", "CPF", "Evento", "Status", "Data", "Hora", "Distancia", "Dentro do raio", "Facial", "Observacao"];
  const rowForEvent = (event: any) => {
    const waiter = waiters.get(event.waiter_id) || {};
    return [
      waiter.name || "Funcionario",
      waiter.role || "",
      waiter.email || "",
      waiter.cpf || "",
      labels[event.event_type] || event.event_type,
      event.status || "",
      formatDate(event.occurred_at),
      formatTime(event.occurred_at),
      event.distance_meters == null ? "" : `${Math.round(Number(event.distance_meters))}m`,
      event.within_geofence === null || event.within_geofence === undefined ? "" : event.within_geofence ? "Sim" : "Nao",
      event.face_status || "",
      event.review_reason || "",
    ];
  };
  const csvLines = [
    headers.map(csvEscape).join(";"),
    ...(events || []).map((event: any) => rowForEvent(event).map(csvEscape).join(";")),
  ];
  const eventsByWaiter = new Map<string, any[]>();
  for (const event of events || []) {
    const key = event.waiter_id || "sem-funcionario";
    eventsByWaiter.set(key, [...(eventsByWaiter.get(key) || []), event]);
  }
  const occurrencesByWaiter = new Map<string, any[]>();
  for (const occurrence of occurrences || []) {
    const key = occurrence.waiter_id || "sem-funcionario";
    occurrencesByWaiter.set(key, [...(occurrencesByWaiter.get(key) || []), occurrence]);
  }
  const employeeIds = Array.from(new Set([...eventsByWaiter.keys(), ...occurrencesByWaiter.keys()]));
  const mirrorHeader = [
    "Data",
    "Dia",
    "Entrada",
    "Inicio intervalo",
    "Fim intervalo",
    "Saida",
    "Horas previstas",
    "Horas trabalhadas",
    "Intervalo",
    "Horas extras",
    "Horas faltantes",
    "Ocorrencia",
    "Status/Auditoria",
    "Observacao",
  ];
  const employeeMirrors = employeeIds.map((employeeId) => {
    const waiter = waiters.get(employeeId) || {};
    const dailyRows = buildDailyMirrorRows({
      employeeEvents: eventsByWaiter.get(employeeId) || [],
      employeeOccurrences: occurrencesByWaiter.get(employeeId) || [],
      period,
      settings,
    });
    const totals = dailyRows.reduce((acc, row) => ({
      expected: acc.expected + row.expectedMinutes,
      worked: acc.worked + row.workedMinutes,
      breakMinutes: acc.breakMinutes + row.breakMinutes,
      overtime: acc.overtime + row.overtime,
      deficit: acc.deficit + row.deficit,
      absences: acc.absences + (row.status.includes("Falta sem lancamento") ? 1 : 0),
      alerts: acc.alerts + (["Ok", "Nao previsto", "Ocorrencia aprovada"].includes(row.status) ? 0 : 1),
    }), { expected: 0, worked: 0, breakMinutes: 0, overtime: 0, deficit: 0, absences: 0, alerts: 0 });
    return {
      id: employeeId,
      name: waiter.name || "Funcionario",
      role: waiter.role || "",
      email: waiter.email || "",
      cpf: waiter.cpf || "",
      dailyRows,
      totals,
    };
  });
  const approvedCount = (events || []).filter((event: any) => event.status === "approved").length;
  const pendingCount = (events || []).filter((event: any) => event.status === "pending_review").length;
  const rejectedCount = (events || []).filter((event: any) => event.status === "rejected").length;
  const workbook = createXlsxWorkbook([
    {
      name: "Resumo",
      rows: [
        ["Restaurante", profile.restaurantName],
        ["Periodo", `${period.start.toLocaleDateString("pt-BR")} a ${period.end.toLocaleDateString("pt-BR")}`],
        ["Total de registros", String((events || []).length)],
        ["Aprovados", String(approvedCount)],
        ["Em revisao", String(pendingCount)],
        ["Rejeitados", String(rejectedCount)],
        ["Jornada diaria configurada", formatMinutes(Number(settings.standard_daily_minutes || 480))],
        ["Jornada semanal configurada", formatMinutes(Number(settings.standard_weekly_minutes || 2640))],
        ["Intervalo minimo configurado", formatMinutes(Number(settings.minimum_break_minutes || 60))],
        [],
        ["Funcionario", "Cargo", "Registros", "Previstas", "Trabalhadas", "Extras", "Faltantes", "Faltas", "Alertas", "Aprovados", "Em revisao", "Rejeitados"],
        ...employeeMirrors.map((employee) => [
          employee.name,
          employee.role,
          String((eventsByWaiter.get(employee.id) || []).length),
          formatMinutes(employee.totals.expected),
          formatMinutes(employee.totals.worked),
          formatMinutes(employee.totals.overtime),
          formatMinutes(employee.totals.deficit),
          String(employee.totals.absences),
          String(employee.totals.alerts),
          String((eventsByWaiter.get(employee.id) || []).filter((event: any) => event.status === "approved").length),
          String((eventsByWaiter.get(employee.id) || []).filter((event: any) => event.status === "pending_review").length),
          String((eventsByWaiter.get(employee.id) || []).filter((event: any) => event.status === "rejected").length),
        ]),
      ],
    },
    ...employeeMirrors.map((employee) => ({
      name: employee.name,
      rows: [
        ["Funcionario", employee.name],
        ["Cargo", employee.role],
        ["Email", employee.email],
        ["CPF", employee.cpf],
        ["Periodo", `${period.start.toLocaleDateString("pt-BR")} a ${period.end.toLocaleDateString("pt-BR")}`],
        ["Horas previstas", formatMinutes(employee.totals.expected)],
        ["Horas trabalhadas", formatMinutes(employee.totals.worked)],
        ["Horas extras", formatMinutes(employee.totals.overtime)],
        ["Horas faltantes", formatMinutes(employee.totals.deficit)],
        [],
        mirrorHeader,
        ...employee.dailyRows.map((row) => [
          row.date,
          row.weekday,
          row.firstIn,
          row.breakStart,
          row.breakEnd,
          row.lastOut,
          formatMinutes(row.expectedMinutes),
          formatMinutes(row.workedMinutes),
          formatMinutes(row.breakMinutes),
          formatMinutes(row.overtime),
          formatMinutes(row.deficit),
          row.occurrenceLabel,
          row.status,
          row.occurrenceNotes,
        ]),
        [],
        ["Batidas brutas"],
        headers,
        ...(eventsByWaiter.get(employee.id) || []).map(rowForEvent),
      ],
    })),
  ]);
  const html = `
    <div style="font-family:Arial,sans-serif;color:#063b2a">
      <h2>Relatorio mensal de ponto - ${htmlEscape(profile.restaurantName)}</h2>
      <p>Periodo: ${period.start.toLocaleDateString("pt-BR")} a ${period.end.toLocaleDateString("pt-BR")}</p>
      <p><strong>Total de registros:</strong> ${(events || []).length}</p>
      <p><strong>Aprovados:</strong> ${approvedCount} | <strong>Em revisao:</strong> ${pendingCount}</p>
      <p>Seguem anexos o CSV geral e a planilha Excel com resumo, espelho por funcionario, horas trabalhadas, extras, faltantes, ocorrencias e auditoria das batidas.</p>
    </div>
  `;

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Relatorio de ponto ${period.label} - ${profile.restaurantName}`,
    html,
    attachments: [{
      filename: `relatorio-ponto-${period.label.replace("/", "-")}.csv`,
      content: encodeBase64Utf8(csvLines.join("\n")),
    }, {
      filename: `relatorio-ponto-${period.label.replace("/", "-")}.xlsx`,
      content: encodeBase64Bytes(workbook),
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
