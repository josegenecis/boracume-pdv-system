import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildFiscalItems,
  generateNFCeXML,
  normalizeCfopForDestination,
  resolveOperationDestination,
} from "./index.ts";

const settings = {
  ambiente: "homologacao",
  endereco_uf: "CE",
  codigo_municipio: "2304400",
  cnpj: "44625108000145",
  razao_social: "EMITENTE TESTE",
  nome_fantasia: "EMITENTE TESTE",
  endereco_logradouro: "Rua Teste",
  endereco_numero: "1",
  endereco_bairro: "Centro",
  endereco_municipio: "Fortaleza",
  endereco_cep: "60000000",
  inscricao_estadual: "123456789",
  regime_tributario: 1,
  rtc_enabled: true,
  rtc_aliquota_ibs_uf: 0.1,
  rtc_aliquota_ibs_mun: 0,
  rtc_aliquota_cbs: 0.9,
};

function generateFor(productFiscal: Record<string, unknown>) {
  const items = buildFiscalItems(
    [
      {
        product_id: "product-1",
        product_name: "Produto",
        quantity: 1,
        price: 100,
        subtotal: 100,
      },
    ],
    settings,
    new Map([["product-1", {
      fiscal_ncm: "21069090",
      fiscal_cfop: "5102",
      fiscal_csosn: "102",
      fiscal_cst_pis: "07",
      fiscal_cst_cofins: "07",
      fiscal_ibs_cbs_cst: "000",
      fiscal_cclass_trib: "000001",
      ...productFiscal,
    }]]),
  );
  const xml = generateNFCeXML({
    fiscalSettings: settings,
    cupom: {
      chave_acesso: "23260844625108000145650010000000011000000010",
      serie: "1",
      numero: 1,
      data_hora_emissao: "2026-08-03T12:00:00.000Z",
    },
    order: {},
    items,
    paymentMethod: "pix",
    deliveryFee: 0,
    totalProdutos: 100,
    valorDesconto: 0,
    valorTotal: 100,
    valorTributos: 7.65,
  });
  return { items, xml };
}

Deno.test("gera IBS/CBS integral por item e totaliza o documento", () => {
  const { items, xml } = generateFor({
    fiscal_ibs_cbs_cst: "000",
    fiscal_cclass_trib: "000001",
  });
  assertEquals(items[0].valor_ibs_uf, 0.1);
  assertEquals(items[0].valor_cbs, 0.9);
  assertStringIncludes(
    xml,
    "<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib>",
  );
  assertStringIncludes(xml, "<vIBSUF>0.10</vIBSUF>");
  assertStringIncludes(xml, "<vCBS>0.90</vCBS>");
  assertStringIncludes(xml, "<IBSCBSTot><vBCIBSCBS>100.00</vBCIBSCBS>");
});

Deno.test("gera grupos de reducao para bares e restaurantes", () => {
  const { items, xml } = generateFor({
    fiscal_ibs_cbs_cst: "200",
    fiscal_cclass_trib: "200047",
    fiscal_reducao_ibs: 40,
    fiscal_reducao_cbs: 40,
  });
  assertEquals(items[0].valor_ibs_uf, 0.06);
  assertEquals(items[0].valor_cbs, 0.54);
  assertStringIncludes(xml, "<CST>200</CST><cClassTrib>200047</cClassTrib>");
  assertStringIncludes(
    xml,
    "<gRed><pRedAliq>40.0000</pRedAliq><pAliqEfet>0.0600</pAliqEfet></gRed>",
  );
  assertStringIncludes(
    xml,
    "<gRed><pRedAliq>40.0000</pRedAliq><pAliqEfet>0.5400</pAliqEfet></gRed>",
  );
});

Deno.test("classifica CE para PE e usa o CFOP interestadual definido pela regra", () => {
  const consumerData = { state: "PE", country_code: "1058" };
  const destination = resolveOperationDestination(settings, consumerData, "55");
  const items = buildFiscalItems(
    [
      {
        product_id: "product-1",
        product_name: "Produto",
        quantity: 1,
        price: 100,
      },
    ],
    settings,
    new Map([["product-1", {
      fiscal_ncm: "21069090",
      fiscal_cfop: "6102",
      fiscal_csosn: "102",
      fiscal_cst_pis: "07",
      fiscal_cst_cofins: "07",
      fiscal_ibs_cbs_cst: "000",
      fiscal_cclass_trib: "000001",
    }]]),
    destination,
  );
  assertEquals(destination, 2);
  assertEquals(items[0].cfop, "6102");
  const xml = generateNFCeXML({
    fiscalSettings: settings,
    cupom: {
      chave_acesso: "23260844625108000145550010000000011000000010",
      serie: "1",
      numero: 1,
      data_hora_emissao: "2026-08-03T12:00:00.000Z",
    },
    order: {},
    items,
    consumerData,
    modelCode: "55",
    paymentMethod: "pix",
    deliveryFee: 0,
    totalProdutos: 100,
    valorDesconto: 0,
    valorTotal: 100,
    valorTributos: 7.65,
  });
  assertStringIncludes(xml, "<idDest>2</idDest>");
  assertStringIncludes(xml, "<CFOP>6102</CFOP>");
});

Deno.test("mantem operacao na mesma UF como interna", () => {
  assertEquals(
    resolveOperationDestination(
      settings,
      { state: "CE", country_code: "1058" },
      "55",
    ),
    1,
  );
  assertEquals(normalizeCfopForDestination("6102", 1), "5102");
});

Deno.test("gera CSOSN 500 com ICMS-ST retido e ICMS efetivo proporcionais a quantidade", () => {
  const { items, xml } = generateFor({
    fiscal_ncm: "22021000",
    fiscal_cfop: "5405",
    fiscal_csosn: "500",
    fiscal_cest: "0301100",
    fiscal_icms_st_base_ret_unit: 10,
    fiscal_icms_st_aliquota: 20,
    fiscal_icms_substituto_unit: 1.2,
    fiscal_icms_st_ret_unit: 0.8,
    fiscal_icms_efetivo_reducao: 0,
    fiscal_icms_efetivo_aliquota: 20,
  });
  assertEquals(items[0].icms_st_base_retida, 10);
  assertEquals(items[0].icms_st_retido, 0.8);
  assertStringIncludes(xml, "<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN>");
  assertStringIncludes(xml, "<vBCSTRet>10.00</vBCSTRet><pST>20.0000</pST>");
  assertStringIncludes(
    xml,
    "<vICMSSubstituto>1.20</vICMSSubstituto><vICMSSTRet>0.80</vICMSSTRet>",
  );
  assertStringIncludes(
    xml,
    "<vBCEfet>100.00</vBCEfet><pICMSEfet>20.0000</pICMSEfet><vICMSEfet>20.00</vICMSEfet>",
  );
});

Deno.test("usa CFOP proprio de revenda ST nas operacoes interna e interestadual", () => {
  assertEquals(normalizeCfopForDestination("5405", 1), "5405");
  assertEquals(normalizeCfopForDestination("5405", 2), "6404");
  assertEquals(normalizeCfopForDestination("6404", 1), "5405");
  assertEquals(normalizeCfopForDestination("6404", 2), "6404");
});

Deno.test("nao inventa correspondencia de CFOP desconhecida", () => {
  assertThrows(
    () => normalizeCfopForDestination("5949", 2),
    Error,
    "não possui correspondência fiscal aprovada",
  );
});

Deno.test("classifica destinatario fora do Brasil como exterior", () => {
  assertEquals(
    resolveOperationDestination(
      settings,
      { state: "EX", country_code: "2496" },
      "55",
    ),
    3,
  );
  assertEquals(normalizeCfopForDestination("5102", 3), "7102");
});
