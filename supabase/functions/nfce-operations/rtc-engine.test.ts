import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildRtcItemXml, buildRtcTotalsXml } from "./rtc-engine.ts";

const standard = {
  valor_total: 100,
  cst_ibs_cbs: "200",
  cclass_trib: "200047",
  rtc_config: {
    enabled: true,
    mode: "standard" as const,
    ibsUf: { rate: 0.1, reduction: 40 },
    ibsMun: { rate: 0 },
    cbs: { rate: 0.9, reduction: 40 },
  },
};

Deno.test("gera IBS e CBS regular com reducao e totais", () => {
  const xml = buildRtcItemXml(standard);
  assertStringIncludes(
    xml,
    "<IBSCBS><CST>200</CST><cClassTrib>200047</cClassTrib>",
  );
  assertStringIncludes(
    xml,
    "<pAliqEfet>0.0600</pAliqEfet></gRed><vIBSUF>0.06</vIBSUF>",
  );
  assertStringIncludes(buildRtcTotalsXml([standard]), "<vCBS>0.54</vCBS>");
  assertStringIncludes(
    buildRtcTotalsXml([standard], 100),
    "<vNFTot>100.60</vNFTot>",
  );
});

Deno.test("gera Imposto Seletivo percentual e total", () => {
  const item = {
    valor_total: 100,
    is_config: { enabled: true, cst: "000", cClassTrib: "000001", rate: 10 },
  };
  assertStringIncludes(buildRtcItemXml(item), "<vIS>10.00</vIS>");
  assertEquals(buildRtcTotalsXml([item]), "<ISTot><vIS>10.00</vIS></ISTot>");
});

Deno.test("gera monofasia e transferencia de credito", () => {
  assertStringIncludes(
    buildRtcItemXml({
      valor_total: 10,
      cst_ibs_cbs: "620",
      cclass_trib: "620001",
      rtc_config: {
        enabled: true,
        mode: "monophase",
        monophase: {
          qBCMono: 2,
          adRemIBS: 1,
          vIBSMono: 2,
          adRemCBS: 2,
          vCBSMono: 4,
          vTotIBSMonoItem: 2,
          vTotCBSMonoItem: 4,
        },
      },
    }),
    "<gIBSCBSMono>",
  );
  assertStringIncludes(
    buildRtcItemXml({
      valor_total: 10,
      cst_ibs_cbs: "800",
      cclass_trib: "800001",
      rtc_config: {
        enabled: true,
        mode: "transfer_credit",
        transferCredit: { vIBS: 1, vCBS: 2 },
      },
    }),
    "<gTransfCred><vIBS>1.00</vIBS><vCBS>2.00</vCBS>",
  );
});

Deno.test("bloqueia IS especifico sem unidade e quantidade", () => {
  assertThrows(
    () =>
      buildRtcItemXml({
        valor_total: 10,
        is_config: {
          enabled: true,
          cst: "000",
          cClassTrib: "000001",
          specificRate: 2,
        },
      }),
    Error,
    "unidade e quantidade",
  );
});

Deno.test("calcula IS especifico conforme a formula da NT", () => {
  const xml = buildRtcItemXml({
    valor_total: 100,
    is_config: {
      enabled: true,
      cst: "000",
      cClassTrib: "000001",
      rate: 10,
      specificRate: 200,
      unit: "UN",
      quantity: 2,
    },
  });
  assertStringIncludes(xml, "<vIS>14.00</vIS>");
});
