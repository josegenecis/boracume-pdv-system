import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCertificateFromBase64, validateCertificate } from './certificate-utils.ts';
import { SefazClient } from './sefaz-client.ts';
import { generateQRCodeData } from './qrcode-generator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Ambiente = 'producao' | 'homologacao';

interface NFCeData {
  operation: 'emitir' | 'consultar' | 'cancelar' | 'download_xml' | 'testar_conexao';
  order_id?: string;
  cupom_id?: string;
  consumer_data?: {
    nome?: string;
    cpf_cnpj?: string;
    email?: string;
  };
  observacoes?: string;
  motivo?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Authorization header is required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authorization token');

    const requestData: NFCeData = await req.json();
    switch (requestData.operation) {
      case 'emitir':
        return await emitirNFCe(supabase, user.id, requestData);
      case 'consultar':
        return await consultarNFCe(supabase, user.id, required(requestData.cupom_id, 'cupom_id'));
      case 'cancelar':
        return await cancelarNFCe(
          supabase,
          user.id,
          required(requestData.cupom_id, 'cupom_id'),
          requestData.motivo || 'Cancelamento solicitado pelo usuario'
        );
      case 'download_xml':
        return await downloadXML(supabase, user.id, required(requestData.cupom_id, 'cupom_id'));
      case 'testar_conexao':
        return await testarConexaoSefaz(supabase, user.id);
      default:
        throw new Error('Operacao nao suportada');
    }
  } catch (error) {
    console.error('Error in nfce-operations:', error);
    return json({ error: error.message || 'Erro interno do servidor' }, 400);
  }
});

async function emitirNFCe(supabase: any, userId: string, data: NFCeData) {
  const fiscalSettings = await loadFiscalSettings(supabase, userId, true);
  validateFiscalSettingsForEmission(fiscalSettings);
  const { certInfo, sefazClient } = loadSefazClient(fiscalSettings);

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', required(data.order_id, 'order_id'))
      .eq('user_id', userId)
      .single();
    if (orderError || !order) throw new Error('Pedido nao encontrado');

    const orderItems = normalizeOrderItems(order.items);
    if (orderItems.length === 0) throw new Error('Pedido sem itens para emissao fiscal');

    const numeroNFCe = await getNextNFCeNumber(supabase, userId, fiscalSettings.nfce_serie);
    const dataEmissao = new Date();
    const chaveAcesso = await generateAccessKey(supabase, fiscalSettings, numeroNFCe, dataEmissao);
    const fiscalItems = buildFiscalItems(orderItems, fiscalSettings);
    const deliveryFee = money(order.delivery_fee || 0);
    const totalProdutos = money(fiscalItems.reduce((sum, item) => sum + item.valor_total, 0));
    const valorTotal = money(order.total || totalProdutos + deliveryFee);
    const valorDesconto = money(order.discount || 0);
    const valorTributos = money((totalProdutos + deliveryFee) * 0.0765);

    const { data: cupom, error: cupomError } = await supabase
      .from('nfce_cupons')
      .insert([{
        user_id: userId,
        order_id: order.id,
        numero: numeroNFCe,
        serie: fiscalSettings.nfce_serie,
        chave_acesso: chaveAcesso,
        valor_total: valorTotal,
        valor_desconto: valorDesconto,
        valor_tributos: valorTributos,
        consumidor_nome: data.consumer_data?.nome || null,
        consumidor_cpf_cnpj: onlyDigits(data.consumer_data?.cpf_cnpj) || null,
        status: 'pendente',
        contingencia: false,
        data_hora_emissao: dataEmissao.toISOString(),
      }])
      .select()
      .single();
    if (cupomError) throw new Error(`Erro ao criar cupom: ${cupomError.message}`);

    const items = fiscalItems.map((item) => ({ ...item, cupom_id: cupom.id }));
    const { error: itemsError } = await supabase.from('nfce_items').insert(items);
    if (itemsError) throw new Error(`Erro ao criar itens do cupom: ${itemsError.message}`);

    const xmlContent = generateNFCeXML({
      fiscalSettings,
      cupom,
      items,
      consumerData: data.consumer_data,
      observacoes: data.observacoes,
      paymentMethod: order.payment_method,
      deliveryFee,
      totalProdutos,
      valorDesconto,
      valorTotal,
      valorTributos,
    });

    const transmissionResult = await sefazClient.enviarNFCe(
      xmlContent,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente
    );

    const authorized = transmissionResult.success && ['100', '150'].includes(transmissionResult.cStat);
    let qrCodeUrl = '';
    if (authorized) {
      qrCodeUrl = generateQRCodeData(
        chaveAcesso,
        fiscalSettings.endereco_uf,
        fiscalSettings.ambiente as Ambiente,
        cupom.data_hora_emissao,
        valorTotal,
        data.consumer_data?.cpf_cnpj,
        fiscalSettings.csc_id,
        fiscalSettings.csc_token,
        transmissionResult.digestValue
      );
    }

    const updateData: any = {
      xml_content: transmissionResult.xmlEnviado || xmlContent,
      status: authorized ? 'autorizado' : 'rejeitado',
      motivo_rejeicao: authorized ? null : `${transmissionResult.cStat} - ${transmissionResult.xMotivo}`,
      updated_at: new Date().toISOString(),
    };
    if (authorized) {
      updateData.protocolo_autorizacao = transmissionResult.protocolo;
      updateData.data_hora_autorizacao = new Date().toISOString();
      updateData.xml_autorizado = transmissionResult.xmlRetorno;
      updateData.qr_code_url = qrCodeUrl;
    }

    await supabase.from('nfce_cupons').update(updateData).eq('id', cupom.id);
    await supabase.from('nfce_transmissions').insert([{
      cupom_id: cupom.id,
      tipo_operacao: 'emissao',
      xml_enviado: transmissionResult.xmlEnviado || xmlContent,
      xml_retorno: transmissionResult.xmlRetorno,
      codigo_status: transmissionResult.cStat,
      motivo: transmissionResult.xMotivo,
      protocolo: transmissionResult.protocolo,
      sucesso: authorized,
    }]);

    return json({
      success: authorized,
      cupom_id: cupom.id,
      numero: numeroNFCe,
      chave_acesso: chaveAcesso,
      status: updateData.status,
      protocolo: transmissionResult.protocolo,
      motivo: transmissionResult.xMotivo,
      certificado_cnpj: certInfo.cnpj,
    });
  } finally {
    sefazClient.close();
  }
}

async function consultarNFCe(supabase: any, userId: string, cupomId: string) {
  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .select('*')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();
  if (cupomError || !cupom) throw new Error('Cupom nao encontrado');

  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const { sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.consultarNFCe(
      cupom.chave_acesso,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente
    );

    const status = ['100', '150'].includes(result.cStat) ? 'autorizado' : cupom.status;
    await supabase.from('nfce_cupons').update({
      status,
      protocolo_autorizacao: result.protocolo || cupom.protocolo_autorizacao,
      motivo_rejeicao: result.success ? null : `${result.cStat} - ${result.xMotivo}`,
      updated_at: new Date().toISOString(),
    }).eq('id', cupomId);

    await supabase.from('nfce_transmissions').insert([{
      cupom_id: cupomId,
      tipo_operacao: 'consulta',
      xml_retorno: result.xmlRetorno,
      codigo_status: result.cStat,
      motivo: result.xMotivo,
      protocolo: result.protocolo,
      sucesso: result.success,
    }]);

    return json({ success: result.success, status, protocolo: result.protocolo, motivo: result.xMotivo });
  } finally {
    sefazClient.close();
  }
}

async function cancelarNFCe(supabase: any, userId: string, cupomId: string, motivo: string) {
  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .select('*')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();
  if (cupomError || !cupom) throw new Error('Cupom nao encontrado');
  if (cupom.status !== 'autorizado') throw new Error('Apenas cupons autorizados podem ser cancelados');
  if (!cupom.protocolo_autorizacao) throw new Error('Cupom autorizado sem protocolo salvo');

  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const { sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.cancelarNFCe(
      cupom.chave_acesso,
      cupom.protocolo_autorizacao,
      motivo,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      fiscalSettings.cnpj
    );

    if (result.success) {
      await supabase.from('nfce_cupons').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', cupomId);
    }
    await supabase.from('nfce_transmissions').insert([{
      cupom_id: cupomId,
      tipo_operacao: 'cancelamento',
      xml_retorno: result.xmlRetorno,
      codigo_status: result.cStat,
      motivo: result.xMotivo || motivo,
      protocolo: result.protocolo,
      sucesso: result.success,
    }]);

    return json({ success: result.success, motivo: result.success ? 'Cancelado com sucesso' : result.xMotivo });
  } finally {
    sefazClient.close();
  }
}

async function testarConexaoSefaz(supabase: any, userId: string) {
  const fiscalSettings = await loadFiscalSettings(supabase, userId, true);
  validateFiscalSettingsForEmission(fiscalSettings);
  const { certInfo, sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.consultarStatusServico(
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente
    );
    return json({
      success: result.success,
      cStat: result.cStat,
      motivo: result.xMotivo,
      ambiente: fiscalSettings.ambiente,
      uf: fiscalSettings.endereco_uf,
      certificado_cnpj: certInfo.cnpj,
    });
  } finally {
    sefazClient.close();
  }
}

async function downloadXML(supabase: any, userId: string, cupomId: string) {
  const { data: cupom, error } = await supabase
    .from('nfce_cupons')
    .select('xml_autorizado, xml_content, numero')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();
  if (error || !cupom) throw new Error('Cupom nao encontrado');

  const xml = cupom.xml_autorizado || cupom.xml_content;
  if (!xml) throw new Error('XML nao disponivel para este cupom');
  return json({ xml, numero: cupom.numero });
}

async function loadFiscalSettings(supabase: any, userId: string, activeOnly: boolean) {
  let query = supabase.from('fiscal_settings').select('*').eq('user_id', userId);
  if (activeOnly) query = query.eq('ativo', true);
  const { data, error } = await query.single();
  if (error || !data) throw new Error('Configuracoes fiscais nao encontradas ou inativas');
  return data;
}

function loadSefazClient(fiscalSettings: any) {
  if (!fiscalSettings.certificado_a1_base64 || !fiscalSettings.certificado_senha) {
    throw new Error('Certificado digital A1 nao configurado');
  }
  const certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
  const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
  if (!validation.valid) throw new Error(`Certificado invalido: ${validation.errors.join(', ')}`);
  return { certInfo, sefazClient: new SefazClient(certInfo) };
}

function validateFiscalSettingsForEmission(settings: any) {
  const requiredFields = [
    'cnpj', 'razao_social', 'endereco_logradouro', 'endereco_numero', 'endereco_bairro',
    'endereco_municipio', 'endereco_uf', 'endereco_cep', 'codigo_municipio',
    'nfce_serie', 'csc_id', 'csc_token',
  ];
  const missing = requiredFields.filter((field) => !String(settings[field] || '').trim());
  if (missing.length) throw new Error(`Configuracao fiscal incompleta: ${missing.join(', ')}`);
}

async function getNextNFCeNumber(supabase: any, userId: string, serie: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_next_nfce_number', { p_user_id: userId, p_serie: serie });
  if (error) throw new Error(`Erro ao gerar numero da NFC-e: ${error.message}`);
  return Number(data);
}

async function generateAccessKey(supabase: any, fiscalSettings: any, numero: number, dataEmissao: Date): Promise<string> {
  const aamm = `${dataEmissao.getFullYear().toString().slice(-2)}${String(dataEmissao.getMonth() + 1).padStart(2, '0')}`;
  const codigoNumerico = crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(0, 8).padStart(8, '0');
  const { data, error } = await supabase.rpc('generate_nfce_access_key', {
    p_uf: getCodigoUF(fiscalSettings.endereco_uf),
    p_aamm: aamm,
    p_cnpj: onlyDigits(fiscalSettings.cnpj),
    p_modelo: '65',
    p_serie: String(fiscalSettings.nfce_serie),
    p_numero: String(numero),
    p_tipo_emissao: '1',
    p_codigo_numerico: codigoNumerico,
  });
  if (error) throw new Error(`Erro ao gerar chave de acesso: ${error.message}`);
  return String(data);
}

function normalizeOrderItems(rawItems: unknown): any[] {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildFiscalItems(orderItems: any[], settings: any) {
  return orderItems.map((item, index) => {
    const quantity = Math.max(Number(item.quantity || 1), 0.0001);
    const unitPrice = money(item.price || item.valor_unitario || 0);
    const total = money(item.subtotal ?? unitPrice * quantity);
    const ncm = String(item.ncm || item.fiscal_ncm || settings.ncm_padrao || '21069090').replace(/\D/g, '').padStart(8, '0').slice(0, 8);
    return {
      product_id: item.product_id || null,
      codigo_produto: sanitizeCode(item.sku || item.codigo_produto || item.product_id || String(index + 1).padStart(6, '0')),
      descricao: String(item.product_name || item.name || item.descricao || `Item ${index + 1}`),
      ncm,
      cfop: String(item.cfop || item.fiscal_cfop || settings.cfop_padrao || '5102'),
      unidade: String(item.unidade || 'UN'),
      quantidade: quantity,
      valor_unitario: unitPrice,
      valor_total: total,
      valor_desconto: money(item.discount || 0),
      cst_icms: String(item.csosn || item.cst_icms || settings.csosn_padrao || '102'),
      aliquota_icms: Number(item.aliquota_icms || 0),
      valor_icms: Number(item.valor_icms || 0),
      cst_pis: String(item.cst_pis || settings.cst_pis_padrao || '07'),
      aliquota_pis: Number(item.aliquota_pis || 0),
      valor_pis: Number(item.valor_pis || 0),
      cst_cofins: String(item.cst_cofins || settings.cst_cofins_padrao || '07'),
      aliquota_cofins: Number(item.aliquota_cofins || 0),
      valor_cofins: Number(item.valor_cofins || 0),
    };
  });
}

function generateNFCeXML(input: {
  fiscalSettings: any;
  cupom: any;
  items: any[];
  consumerData?: any;
  observacoes?: string;
  paymentMethod: string;
  deliveryFee: number;
  totalProdutos: number;
  valorDesconto: number;
  valorTotal: number;
  valorTributos: number;
}): string {
  const {
    fiscalSettings,
    cupom,
    items,
    consumerData,
    observacoes,
    paymentMethod,
    deliveryFee,
    totalProdutos,
    valorDesconto,
    valorTotal,
    valorTributos,
  } = input;
  const isHomologacao = fiscalSettings.ambiente !== 'producao';
  const dhEmi = formatNfeDate(new Date(cupom.data_hora_emissao));
  const consumidorDoc = onlyDigits(consumerData?.cpf_cnpj);
  const detXml = items.map((item, index) => {
    const productName = isHomologacao && index === 0
      ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : item.descricao;
    return `<det nItem="${index + 1}"><prod><cProd>${escapeXml(item.codigo_produto)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${escapeXml(productName)}</xProd><NCM>${item.ncm}</NCM><CFOP>${item.cfop}</CFOP><uCom>${escapeXml(item.unidade)}</uCom><qCom>${fixed4(item.quantidade)}</qCom><vUnCom>${fixed4(item.valor_unitario)}</vUnCom><vProd>${fixed2(item.valor_total)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${escapeXml(item.unidade)}</uTrib><qTrib>${fixed4(item.quantidade)}</qTrib><vUnTrib>${fixed4(item.valor_unitario)}</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>${fixed2(item.valor_total * 0.0765)}</vTotTrib><ICMS><ICMSSN102><orig>0</orig><CSOSN>${item.cst_icms}</CSOSN></ICMSSN102></ICMS><PIS><PISOutr><CST>${item.cst_pis}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS><COFINS><COFINSOutr><CST>${item.cst_cofins}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS></imposto></det>`;
  }).join('');

  const destXml = consumidorDoc
    ? `<dest>${consumidorDoc.length === 11 ? `<CPF>${consumidorDoc}</CPF>` : `<CNPJ>${consumidorDoc}</CNPJ>`}${consumerData?.nome ? `<xNome>${escapeXml(consumerData.nome)}</xNome>` : ''}<indIEDest>9</indIEDest></dest>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${cupom.chave_acesso}" versao="4.00"><ide><cUF>${getCodigoUF(fiscalSettings.endereco_uf)}</cUF><cNF>${cupom.chave_acesso.substring(35, 43)}</cNF><natOp>Venda</natOp><mod>65</mod><serie>${Number(cupom.serie)}</serie><nNF>${cupom.numero}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>${onlyDigits(fiscalSettings.codigo_municipio)}</cMunFG><tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>${cupom.chave_acesso.slice(-1)}</cDV><tpAmb>${isHomologacao ? '2' : '1'}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>PopSystem-1.0</verProc></ide><emit><CNPJ>${onlyDigits(fiscalSettings.cnpj)}</CNPJ><xNome>${escapeXml(fiscalSettings.razao_social)}</xNome><xFant>${escapeXml(fiscalSettings.nome_fantasia || fiscalSettings.razao_social)}</xFant><enderEmit><xLgr>${escapeXml(fiscalSettings.endereco_logradouro)}</xLgr><nro>${escapeXml(fiscalSettings.endereco_numero)}</nro>${fiscalSettings.endereco_complemento ? `<xCpl>${escapeXml(fiscalSettings.endereco_complemento)}</xCpl>` : ''}<xBairro>${escapeXml(fiscalSettings.endereco_bairro)}</xBairro><cMun>${onlyDigits(fiscalSettings.codigo_municipio)}</cMun><xMun>${escapeXml(fiscalSettings.endereco_municipio)}</xMun><UF>${escapeXml(fiscalSettings.endereco_uf)}</UF><CEP>${onlyDigits(fiscalSettings.endereco_cep)}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>${escapeXml(fiscalSettings.inscricao_estadual || 'ISENTO')}</IE><CRT>${Number(fiscalSettings.regime_tributario || 1)}</CRT></emit>${destXml}${detXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${fixed2(totalProdutos)}</vProd><vFrete>${fixed2(deliveryFee)}</vFrete><vSeg>0.00</vSeg><vDesc>${fixed2(valorDesconto)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${fixed2(valorTotal)}</vNF><vTotTrib>${fixed2(valorTributos)}</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><indPag>0</indPag><tPag>${mapPaymentMethod(paymentMethod)}</tPag><vPag>${fixed2(valorTotal)}</vPag></detPag></pag>${observacoes ? `<infAdic><infCpl>${escapeXml(observacoes)}</infCpl></infAdic>` : ''}</infNFe></NFe>`;
}

function mapPaymentMethod(method: string): string {
  const normalized = String(method || '').toLowerCase();
  if (normalized.includes('pix')) return '17';
  if (normalized.includes('debito') || normalized.includes('débito')) return '04';
  if (normalized.includes('credito') || normalized.includes('crédito') || normalized === 'cartao') return '03';
  if (normalized.includes('dinheiro')) return '01';
  return '99';
}

function getCodigoUF(uf: string): string {
  const codigos: Record<string, string> = {
    AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
    DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
    MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
    RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
    SP: '35', SE: '28', TO: '17',
  };
  return codigos[String(uf || '').toUpperCase()] || '35';
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function required(value: string | undefined, field: string): string {
  if (!value) throw new Error(`${field} e obrigatorio`);
  return value;
}

function onlyDigits(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeCode(value: string): string {
  return String(value || '').replace(/[^\w.-]/g, '').slice(0, 60) || '000001';
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function money(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

function fixed2(value: number): string {
  return money(value).toFixed(2);
}

function fixed4(value: number): string {
  return Number(value || 0).toFixed(4);
}

function formatNfeDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '-03:00');
}
