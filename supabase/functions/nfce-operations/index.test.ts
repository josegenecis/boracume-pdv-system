import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { buildFiscalItems, generateNFCeXML } from './index.ts';

const settings = {
  ambiente: 'homologacao',
  endereco_uf: 'CE',
  codigo_municipio: '2304400',
  cnpj: '44625108000145',
  razao_social: 'EMITENTE TESTE',
  nome_fantasia: 'EMITENTE TESTE',
  endereco_logradouro: 'Rua Teste',
  endereco_numero: '1',
  endereco_bairro: 'Centro',
  endereco_municipio: 'Fortaleza',
  endereco_cep: '60000000',
  inscricao_estadual: '123456789',
  regime_tributario: 1,
  rtc_aliquota_ibs_uf: 0.1,
  rtc_aliquota_ibs_mun: 0,
  rtc_aliquota_cbs: 0.9,
};

function generateFor(productFiscal: Record<string, unknown>) {
  const items = buildFiscalItems([
    { product_id: 'product-1', product_name: 'Produto', quantity: 1, price: 100, subtotal: 100 },
  ], settings, new Map([['product-1', {
    fiscal_ncm: '21069090',
    fiscal_cfop: '5102',
    fiscal_csosn: '102',
    fiscal_cst_pis: '07',
    fiscal_cst_cofins: '07',
    ...productFiscal,
  }]]));
  const xml = generateNFCeXML({
    fiscalSettings: settings,
    cupom: {
      chave_acesso: '23260844625108000145650010000000011000000010',
      serie: '1',
      numero: 1,
      data_hora_emissao: '2026-08-03T12:00:00.000Z',
    },
    order: {},
    items,
    paymentMethod: 'pix',
    deliveryFee: 0,
    totalProdutos: 100,
    valorDesconto: 0,
    valorTotal: 100,
    valorTributos: 7.65,
  });
  return { items, xml };
}

Deno.test('gera IBS/CBS integral por item e totaliza o documento', () => {
  const { items, xml } = generateFor({
    fiscal_ibs_cbs_cst: '000',
    fiscal_cclass_trib: '000001',
  });
  assertEquals(items[0].valor_ibs_uf, 0.1);
  assertEquals(items[0].valor_cbs, 0.9);
  assertStringIncludes(xml, '<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib>');
  assertStringIncludes(xml, '<vIBSUF>0.10</vIBSUF>');
  assertStringIncludes(xml, '<vCBS>0.90</vCBS>');
  assertStringIncludes(xml, '<IBSCBSTot><vBCIBSCBS>100.00</vBCIBSCBS>');
});

Deno.test('gera grupos de reducao para bares e restaurantes', () => {
  const { items, xml } = generateFor({
    fiscal_ibs_cbs_cst: '200',
    fiscal_cclass_trib: '200047',
    fiscal_reducao_ibs: 40,
    fiscal_reducao_cbs: 40,
  });
  assertEquals(items[0].valor_ibs_uf, 0.06);
  assertEquals(items[0].valor_cbs, 0.54);
  assertStringIncludes(xml, '<CST>200</CST><cClassTrib>200047</cClassTrib>');
  assertStringIncludes(xml, '<gRed><pRedAliq>40.0000</pRedAliq><pAliqEfet>0.0600</pAliqEfet></gRed>');
  assertStringIncludes(xml, '<gRed><pRedAliq>40.0000</pRedAliq><pAliqEfet>0.5400</pAliqEfet></gRed>');
});
