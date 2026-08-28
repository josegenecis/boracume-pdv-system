// Reforma Tributaria do Consumo — NT 2025.002.
// A configuracao vem de regra fiscal versionada/aprovada. Nenhuma aliquota ou
// classificacao e presumida por este modulo.

export interface RtcConfig {
  enabled?: boolean;
  mode?: "standard" | "monophase" | "transfer_credit" | "none";
  vBC?: number;
  ibsUf?: RtcJurisdiction;
  ibsMun?: RtcJurisdiction;
  cbs?: RtcJurisdiction;
  regularTax?: {
    cst: string;
    cClassTrib: string;
    pAliqEfetRegIBSUF: number;
    vTribRegIBSUF?: number;
    pAliqEfetRegIBSMun: number;
    vTribRegIBSMun?: number;
    pAliqEfetRegCBS: number;
    vTribRegCBS?: number;
  };
  monophase?: Record<string, number>;
  transferCredit?: { vIBS: number; vCBS: number };
}

export interface RtcJurisdiction {
  rate: number;
  reduction?: number;
  effectiveRate?: number;
  deferralPercent?: number;
  deferredValue?: number;
  returnedPercent?: number;
  returnedValue?: number;
  presumedCreditCode?: string;
  presumedCreditPercent?: number;
  presumedCreditValue?: number;
  presumedCreditSuspendedValue?: number;
}

export interface SelectiveTaxConfig {
  enabled?: boolean;
  cst: string;
  cClassTrib: string;
  vBC?: number;
  rate?: number;
  specificRate?: number;
  unit?: string;
  quantity?: number;
  value?: number;
}

export interface RtcItem {
  valor_total: number;
  valor_desconto?: number;
  cst_ibs_cbs?: string;
  cclass_trib?: string;
  rtc_config?: RtcConfig | string | null;
  is_config?: SelectiveTaxConfig | string | null;
}

const n = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: unknown) => Number(n(value).toFixed(2));
const f2 = (value: unknown) => money(value).toFixed(2);
const f4 = (value: unknown) => n(value).toFixed(4);
const tag = (name: string, value: unknown, decimals: 2 | 4 = 2) =>
  `<${name}>${decimals === 4 ? f4(value) : f2(value)}</${name}>`;

function record<T>(value: T | string | null | undefined): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {
      throw new Error("Configuração RTC inválida: JSON malformado");
    }
  }
  return {} as T;
}

function code(value: unknown, size: number, label: string): string {
  const normalized = String(value ?? "").replace(/\D/g, "");
  if (normalized.length !== size) {
    throw new Error(`${label} deve ter ${size} dígitos`);
  }
  return normalized;
}

function jurisdictionXml(
  name: "gIBSUF" | "gIBSMun" | "gCBS",
  input: RtcJurisdiction,
  base: number,
) {
  if (!input || !Number.isFinite(Number(input.rate))) {
    throw new Error(`${name}: alíquota obrigatória`);
  }
  const rate = n(input.rate);
  const reduction = n(input.reduction);
  const effective = input.effectiveRate == null
    ? rate * (1 - reduction / 100)
    : n(input.effectiveRate);
  const gross = money(base * effective / 100);
  const deferred = input.deferredValue == null
    ? money(gross * n(input.deferralPercent) / 100)
    : money(input.deferredValue);
  const returned = input.returnedValue == null
    ? money(gross * n(input.returnedPercent) / 100)
    : money(input.returnedValue);
  const value = money(gross - deferred - returned);
  const taxTag = name === "gIBSUF"
    ? "pIBSUF"
    : name === "gIBSMun"
    ? "pIBSMun"
    : "pCBS";
  const valueTag = name === "gIBSUF"
    ? "vIBSUF"
    : name === "gIBSMun"
    ? "vIBSMun"
    : "vCBS";
  const dif = n(input.deferralPercent) || deferred
    ? `<gDif>${tag("pDif", input.deferralPercent, 4)}${
      tag("vDif", deferred)
    }</gDif>`
    : "";
  const dev = n(input.returnedPercent) || returned
    ? `<gDevTrib>${tag("pDevTrib", input.returnedPercent, 4)}${
      tag("vDevTrib", returned)
    }</gDevTrib>`
    : "";
  const red = reduction
    ? `<gRed>${tag("pRedAliq", reduction, 4)}${
      tag("pAliqEfet", effective, 4)
    }</gRed>`
    : "";
  const cred = input.presumedCreditCode
    ? `<gCredPresOper><cCredPres>${
      code(input.presumedCreditCode, 2, "cCredPres")
    }</cCredPres>${tag("pCredPres", input.presumedCreditPercent, 4)}${
      tag("vCredPres", input.presumedCreditValue)
    }${
      input.presumedCreditSuspendedValue == null
        ? ""
        : tag("vCredPresCondSus", input.presumedCreditSuspendedValue)
    }</gCredPresOper>`
    : "";
  return {
    xml: `<${name}>${tag(taxTag, rate, 4)}${dif}${dev}${red}${
      tag(valueTag, value)
    }${cred}</${name}>`,
    value,
    deferred,
    returned,
    credit: money(input.presumedCreditValue),
  };
}

function monophaseXml(config: Record<string, number>): string {
  const ordered = [
    "qBCMono",
    "adRemIBS",
    "adRemCBS",
    "vIBSMono",
    "vCBSMono",
    "qBCMonoReten",
    "adRemIBSReten",
    "vIBSMonoReten",
    "adRemCBSReten",
    "vCBSMonoReten",
    "qBCMonoRet",
    "adRemIBSRet",
    "vIBSMonoRet",
    "adRemCBSRet",
    "vCBSMonoRet",
    "pDifIBS",
    "vIBSMonoDif",
    "pDifCBS",
    "vCBSMonoDif",
    "vTotIBSMonoItem",
    "vTotCBSMonoItem",
  ];
  if (!ordered.some((field) => config[field] != null)) {
    throw new Error("RTC monofásico exige configuração explícita");
  }
  return `<gIBSCBSMono>${
    ordered.filter((field) => config[field] != null).map((field) =>
      tag(
        field,
        config[field],
        field.startsWith("p") || field.startsWith("adRem") ||
          field.startsWith("q")
          ? 4
          : 2,
      )
    ).join("")
  }</gIBSCBSMono>`;
}

export function buildRtcItemXml(item: RtcItem): string {
  const rtc = record<RtcConfig>(item.rtc_config);
  const selective = record<SelectiveTaxConfig>(item.is_config);
  const selectiveXml = selective.enabled
    ? buildSelectiveTaxXml(item, selective)
    : "";
  if (!rtc.enabled) return selectiveXml;
  const cst = code(item.cst_ibs_cbs, 3, "CST IBS/CBS");
  const cClassTrib = code(item.cclass_trib, 6, "cClassTrib");
  const mode = rtc.mode || "standard";
  let body = "";
  if (mode === "standard") {
    const base = money(
      rtc.vBC ?? Math.max(0, n(item.valor_total) - n(item.valor_desconto)),
    );
    const uf = jurisdictionXml("gIBSUF", rtc.ibsUf as RtcJurisdiction, base);
    const mun = jurisdictionXml("gIBSMun", rtc.ibsMun as RtcJurisdiction, base);
    const cbs = jurisdictionXml("gCBS", rtc.cbs as RtcJurisdiction, base);
    const regular = rtc.regularTax
      ? `<gTribRegular><CSTReg>${
        code(rtc.regularTax.cst, 3, "CSTReg")
      }</CSTReg><cClassTribReg>${
        code(rtc.regularTax.cClassTrib, 6, "cClassTribReg")
      }</cClassTribReg>${
        tag("pAliqEfetRegIBSUF", rtc.regularTax.pAliqEfetRegIBSUF, 4)
      }${
        tag(
          "vTribRegIBSUF",
          rtc.regularTax.vTribRegIBSUF ??
            base * rtc.regularTax.pAliqEfetRegIBSUF / 100,
        )
      }${tag("pAliqEfetRegIBSMun", rtc.regularTax.pAliqEfetRegIBSMun, 4)}${
        tag(
          "vTribRegIBSMun",
          rtc.regularTax.vTribRegIBSMun ??
            base * rtc.regularTax.pAliqEfetRegIBSMun / 100,
        )
      }${tag("pAliqEfetRegCBS", rtc.regularTax.pAliqEfetRegCBS, 4)}${
        tag(
          "vTribRegCBS",
          rtc.regularTax.vTribRegCBS ??
            base * rtc.regularTax.pAliqEfetRegCBS / 100,
        )
      }</gTribRegular>`
      : "";
    body = `<gIBSCBS>${tag("vBC", base)}${uf.xml}${mun.xml}${
      tag("vIBS", uf.value + mun.value)
    }${cbs.xml}${regular}</gIBSCBS>`;
  } else if (mode === "monophase") body = monophaseXml(rtc.monophase || {});
  else if (mode === "transfer_credit") {
    if (!rtc.transferCredit) {
      throw new Error("Transferência de crédito exige vIBS e vCBS");
    }
    body = `<gTransfCred>${tag("vIBS", rtc.transferCredit.vIBS)}${
      tag("vCBS", rtc.transferCredit.vCBS)
    }</gTransfCred>`;
  }
  return `${selectiveXml}<IBSCBS><CST>${cst}</CST><cClassTrib>${cClassTrib}</cClassTrib>${body}</IBSCBS>`;
}

export function buildSelectiveTaxXml(
  item: RtcItem,
  configValue?: SelectiveTaxConfig,
): string {
  const config = configValue || record<SelectiveTaxConfig>(item.is_config);
  if (!config.enabled) return "";
  const base = money(
    config.vBC ?? Math.max(0, n(item.valor_total) - n(item.valor_desconto)),
  );
  const percentValue = base * n(config.rate) / 100;
  const specificValue = n(config.quantity) * n(config.specificRate) / 100;
  const value = money(config.value ?? percentValue + specificValue);
  const specific = config.specificRate == null
    ? ""
    : `${tag("pISEspec", config.specificRate, 4)}<uTrib>${
      String(config.unit || "").slice(0, 6)
    }</uTrib>${tag("qTrib", config.quantity, 4)}`;
  if (
    config.specificRate != null && (!config.unit || n(config.quantity) <= 0)
  ) throw new Error("IS específico exige unidade e quantidade tributável");
  return `<IS><CSTIS>${code(config.cst, 3, "CSTIS")}</CSTIS><cClassTribIS>${
    code(config.cClassTrib, 6, "cClassTribIS")
  }</cClassTribIS>${tag("vBCIS", base)}${
    config.rate == null ? "" : tag("pIS", config.rate, 4)
  }${specific}${tag("vIS", value)}</IS>`;
}

export function validateRtcItem(item: RtcItem): void {
  buildRtcItemXml(item);
}

export function buildRtcTotalsXml(
  items: RtcItem[],
  conventionalInvoiceTotal?: number,
): string {
  const rtcItems = items.filter((item) =>
    record<RtcConfig>(item.rtc_config).enabled
  );
  const isItems = items.filter((item) =>
    record<SelectiveTaxConfig>(item.is_config).enabled
  );
  const isTotal = isItems.reduce((sum, item) => {
    const config = record<SelectiveTaxConfig>(item.is_config);
    const base = config.vBC ??
      Math.max(0, n(item.valor_total) - n(item.valor_desconto));
    return sum + money(
      config.value ??
        base * n(config.rate) / 100 +
          n(config.quantity) * n(config.specificRate) / 100,
    );
  }, 0);
  const configured = rtcItems.map((item) => ({
    item,
    config: record<RtcConfig>(item.rtc_config),
  }));
  const standard = configured.filter(({ config }) =>
    (config.mode || "standard") === "standard"
  );
  const sums = standard.reduce((t, { item, config }) => {
    const base = money(
      config.vBC ?? Math.max(0, n(item.valor_total) - n(item.valor_desconto)),
    );
    const uf = jurisdictionXml("gIBSUF", config.ibsUf as RtcJurisdiction, base);
    const mun = jurisdictionXml(
      "gIBSMun",
      config.ibsMun as RtcJurisdiction,
      base,
    );
    const cbs = jurisdictionXml("gCBS", config.cbs as RtcJurisdiction, base);
    t.base += base;
    t.uf += uf.value;
    t.mun += mun.value;
    t.ufDif += uf.deferred;
    t.munDif += mun.deferred;
    t.ufDev += uf.returned;
    t.munDev += mun.returned;
    t.ibsCred += uf.credit + mun.credit;
    t.ibsCredSuspended += money(
      config.ibsUf?.presumedCreditSuspendedValue,
    ) + money(config.ibsMun?.presumedCreditSuspendedValue);
    t.cbs += cbs.value;
    t.cbsDif += cbs.deferred;
    t.cbsDev += cbs.returned;
    t.cbsCred += cbs.credit;
    t.cbsCredSuspended += money(config.cbs?.presumedCreditSuspendedValue);
    return t;
  }, {
    base: 0,
    uf: 0,
    mun: 0,
    ufDif: 0,
    munDif: 0,
    ufDev: 0,
    munDev: 0,
    ibsCred: 0,
    ibsCredSuspended: 0,
    cbs: 0,
    cbsDif: 0,
    cbsDev: 0,
    cbsCred: 0,
    cbsCredSuspended: 0,
  });
  const mono = configured
    .filter(({ config }) => config.mode === "monophase")
    .reduce((total, { config }) => {
      const value = config.monophase || {};
      total.ibs += n(value.vIBSMono);
      total.cbs += n(value.vCBSMono);
      total.ibsReten += n(value.vIBSMonoReten);
      total.cbsReten += n(value.vCBSMonoReten);
      total.ibsRet += n(value.vIBSMonoRet);
      total.cbsRet += n(value.vCBSMonoRet);
      return total;
    }, { ibs: 0, cbs: 0, ibsReten: 0, cbsReten: 0, ibsRet: 0, cbsRet: 0 });
  const isXml = isItems.length ? `<ISTot>${tag("vIS", isTotal)}</ISTot>` : "";
  const monoXml = configured.some(({ config }) => config.mode === "monophase")
    ? `<gMono>${tag("vIBSMono", mono.ibs)}${tag("vCBSMono", mono.cbs)}${
      tag("vIBSMonoReten", mono.ibsReten)
    }${tag("vCBSMonoReten", mono.cbsReten)}${tag("vIBSMonoRet", mono.ibsRet)}${
      tag("vCBSMonoRet", mono.cbsRet)
    }</gMono>`
    : "";
  const rtcXml = rtcItems.length
    ? `<IBSCBSTot>${tag("vBCIBSCBS", sums.base)}<gIBS><gIBSUF>${
      tag("vDif", sums.ufDif)
    }${tag("vDevTrib", sums.ufDev)}${tag("vIBSUF", sums.uf)}</gIBSUF><gIBSMun>${
      tag("vDif", sums.munDif)
    }${tag("vDevTrib", sums.munDev)}${tag("vIBSMun", sums.mun)}</gIBSMun>${
      tag("vIBS", sums.uf + sums.mun)
    }${tag("vCredPres", sums.ibsCred)}${
      tag("vCredPresCondSus", sums.ibsCredSuspended)
    }</gIBS><gCBS>${tag("vDif", sums.cbsDif)}${tag("vDevTrib", sums.cbsDev)}${
      tag("vCBS", sums.cbs)
    }${tag("vCredPres", sums.cbsCred)}${
      tag("vCredPresCondSus", sums.cbsCredSuspended)
    }</gCBS>${monoXml}</IBSCBSTot>`
    : "";
  const newTaxes = money(
    isTotal + sums.uf + sums.mun + sums.cbs + mono.ibs + mono.cbs,
  );
  const invoiceTotalXml = conventionalInvoiceTotal == null ||
      (!rtcItems.length && !isItems.length)
    ? ""
    : tag("vNFTot", money(conventionalInvoiceTotal) + newTaxes);
  return `${isXml}${rtcXml}${invoiceTotalXml}`;
}
