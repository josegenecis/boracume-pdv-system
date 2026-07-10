import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadCertificateFromBase64, validateCertificate } from './certificate-utils.ts';
import { SefazClient } from './sefaz-client.ts';
import { getSefazEndpoint } from './sefaz-endpoints.ts';
import { getQRCodeBaseUrl } from './qrcode-generator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-diagnostic-key',
};

type Ambiente = 'producao' | 'homologacao';

const NFE_TIMEZONE = 'America/Fortaleza';
const MUNICIPALITY_CODE_OVERRIDES: Record<string, string> = {
  'CE|FORTALEZA': '2304400',
};

interface NFCeData {
  operation:
    | 'emitir'
    | 'consultar'
    | 'cancelar'
    | 'download_xml'
    | 'testar_conexao'
    | 'validar_config'
    | 'diagnosticar_cadastro_email';
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
    const requestData: NFCeData = await req.json();

    if (requestData.operation === 'diagnosticar_cadastro_email') {
      return await diagnosticarCadastroPorEmail(req, supabase, requestData);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Authorization header is required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authorization token');

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
      case 'validar_config':
        return await validarConfiguracaoFiscal(supabase, user.id);
      default:
        throw new Error('Operacao nao suportada');
    }
  } catch (error) {
    console.error('Error in nfce-operations:', error);
    return json({ error: getErrorMessage(error) || 'Erro interno do servidor' }, 400);
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
      order,
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
      fiscalSettings.ambiente as Ambiente,
      {
        chaveAcesso,
        dataEmissao: cupom.data_hora_emissao,
        valorTotal,
        cpfCnpjConsumidor: data.consumer_data?.cpf_cnpj,
        cscId: fiscalSettings.csc_id,
        cscToken: fiscalSettings.csc_token,
      }
    );

    const authorized = transmissionResult.success && ['100', '150'].includes(transmissionResult.cStat);
    const qrCodeUrl = transmissionResult.qrCodeUrl || '';

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
      serie: fiscalSettings.nfce_serie,
      chave_acesso: chaveAcesso,
      qr_code_url: qrCodeUrl,
      xml_content: transmissionResult.xmlEnviado || xmlContent,
      ambiente: fiscalSettings.ambiente,
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

async function validarConfiguracaoFiscal(supabase: any, userId: string) {
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const checklist = buildFiscalReadiness(fiscalSettings);
  let certificate: any = null;

  if (fiscalSettings.certificado_a1_base64 && fiscalSettings.certificado_senha) {
    try {
      const certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
      const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
      certificate = {
        valid: validation.valid,
        errors: validation.errors,
        cnpj: certInfo.cnpj,
        valid_from: certInfo.validFrom.toISOString(),
        valid_to: certInfo.validTo.toISOString(),
        issuer: certInfo.issuer,
      };
      if (!validation.valid) {
        checklist.errors.push(...validation.errors.map((message) => `Certificado: ${message}`));
      }
    } catch (error) {
      const message = getErrorMessage(error);
      checklist.errors.push(`Certificado: ${message}`);
      certificate = { valid: false, errors: [message] };
    }
  }

  const ready = checklist.errors.length === 0;
  return json({
    success: ready,
    ready,
    pilot: 'CE',
    ambiente: fiscalSettings.ambiente,
    uf: fiscalSettings.endereco_uf,
    checklist,
    certificate,
  });
}

async function diagnosticarCadastroPorEmail(req: Request, supabase: any, data: any) {
  const expectedKey = Deno.env.get('NFCE_DIAGNOSTIC_KEY') || '';
  const receivedKey = req.headers.get('x-diagnostic-key') || '';
  if (!expectedKey || receivedKey !== expectedKey) {
    return json({ error: 'Diagnostico nao autorizado' }, 401);
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) throw new Error('email e obrigatorio');

  const user = await findAuthUserByEmail(supabase, email);
  if (!user) return json({ success: false, error: 'Usuario nao encontrado', email });

  const fiscalSettings = await loadFiscalSettings(supabase, user.id, false);
  const readiness = buildFiscalReadiness(fiscalSettings);
  let certificate: any = null;
  let connection: any = null;

  if (fiscalSettings.certificado_a1_base64 && fiscalSettings.certificado_senha) {
    try {
      const certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
      const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
      certificate = {
        valid: validation.valid,
        errors: validation.errors,
        cnpj: certInfo.cnpj,
        expected_cnpj: onlyDigits(fiscalSettings.cnpj),
        cnpj_matches: certInfo.cnpj === onlyDigits(fiscalSettings.cnpj),
        valid_from: certInfo.validFrom.toISOString(),
        valid_to: certInfo.validTo.toISOString(),
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        chain_count: certInfo.certificateChainCount,
      };

      if (validation.valid && readiness.errors.length === 0) {
        const sefazClient = new SefazClient(certInfo);
        try {
          const result = await sefazClient.consultarStatusServico(
            fiscalSettings.endereco_uf,
            fiscalSettings.ambiente as Ambiente
          );
          connection = {
            success: result.success,
            cStat: result.cStat,
            motivo: result.xMotivo,
            rawStatus: result.rawStatus,
          };
        } finally {
          sefazClient.close();
        }
      }
    } catch (error) {
      certificate = { valid: false, errors: [getErrorMessage(error)] };
    }
  }

  return json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    fiscal: {
      ativo: fiscalSettings.ativo,
      cnpj: onlyDigits(fiscalSettings.cnpj),
      razao_social: fiscalSettings.razao_social,
      nome_fantasia: fiscalSettings.nome_fantasia,
      inscricao_estadual: onlyDigits(fiscalSettings.inscricao_estadual),
      uf: fiscalSettings.endereco_uf,
      municipio: fiscalSettings.endereco_municipio,
      codigo_municipio: onlyDigits(fiscalSettings.codigo_municipio),
      ambiente: fiscalSettings.ambiente,
      serie: fiscalSettings.nfce_serie,
      proximo_numero: fiscalSettings.nfce_numero_atual,
      has_csc_id: Boolean(String(fiscalSettings.csc_id || '').trim()),
      has_csc_token: Boolean(String(fiscalSettings.csc_token || '').trim()),
      has_certificate: Boolean(fiscalSettings.certificado_a1_base64),
      certificate_bytes: Math.floor(String(fiscalSettings.certificado_a1_base64 || '').length * 3 / 4),
    },
    readiness,
    certificate,
    connection,
  });
}

async function findAuthUserByEmail(supabase: any, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Erro ao buscar usuarios: ${error.message}`);
    const users = data?.users || [];
    const found = users.find((user: any) => String(user.email || '').toLowerCase() === email);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
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
  const readiness = buildFiscalReadiness(settings);
  if (readiness.errors.length) {
    throw new Error(`Configuracao fiscal incompleta: ${readiness.errors.join('; ')}`);
  }
}

function buildFiscalReadiness(settings: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields = [
    'cnpj', 'razao_social', 'endereco_logradouro', 'endereco_numero', 'endereco_bairro',
    'endereco_municipio', 'endereco_uf', 'endereco_cep', 'codigo_municipio',
    'nfce_serie', 'nfce_numero_atual', 'csc_id', 'csc_token',
  ];
  for (const field of requiredFields) {
    if (!String(settings[field] || '').trim()) errors.push(`Campo obrigatorio ausente: ${field}`);
  }

  const uf = String(settings.endereco_uf || '').toUpperCase();
  let codigoUf = '';
  if (uf) {
    try {
      codigoUf = getCodigoUF(uf);
    } catch (error) {
      errors.push(getErrorMessage(error));
    }
  }
  if (uf && codigoUf) {
    const codigoMunicipio = resolveMunicipalityCode(settings);
    if (codigoMunicipio.length !== 7 || !codigoMunicipio.startsWith(codigoUf)) {
      errors.push(`Codigo do municipio deve ter 7 digitos e comecar com o codigo IBGE da UF ${uf} (${codigoUf})`);
    }
    if (codigoMunicipio !== onlyDigits(settings.codigo_municipio)) {
      warnings.push(`Codigo do municipio normalizado para ${settings.endereco_municipio || 'municipio'}: ${codigoMunicipio}`);
    }
    if (!onlyDigits(settings.inscricao_estadual)) {
      errors.push('Inscricao Estadual e obrigatoria para NFC-e');
    }
  }
  const ambiente = String(settings.ambiente || '') as Ambiente;
  if (uf && String(settings.ambiente || '').match(/^(homologacao|producao)$/)) {
    try {
      getSefazEndpoint(uf, ambiente, 'status');
      getSefazEndpoint(uf, ambiente, 'autorizacao');
      getQRCodeBaseUrl(uf, ambiente);
    } catch (error) {
      errors.push(getErrorMessage(error));
    }
  }

  const cnpj = onlyDigits(settings.cnpj);
  if (cnpj.length !== 14) errors.push('CNPJ deve conter 14 digitos');
  const serie = Number(settings.nfce_serie);
  if (!Number.isInteger(serie) || serie < 1 || serie > 999) errors.push('Serie NFC-e deve ser um numero entre 1 e 999');
  const nextNumber = Number(settings.nfce_numero_atual);
  if (!Number.isInteger(nextNumber) || nextNumber < 1) errors.push('Proximo numero da NFC-e deve ser maior que zero');
  if (!String(settings.ambiente || '').match(/^(homologacao|producao)$/)) errors.push('Ambiente fiscal invalido');
  if (!onlyDigits(settings.csc_id)) errors.push('CSC ID deve ser numerico');
  if (String(settings.csc_token || '').trim().length < 8) warnings.push('Confira se o CSC Token esta completo antes de emitir em producao');
  if (!settings.certificado_a1_base64 || !settings.certificado_senha) errors.push('Certificado A1 e senha sao obrigatorios');
  if (settings.ambiente === 'producao') {
    warnings.push('Producao exige credenciamento NFC-e ativo na Sefaz da UF e CSC de producao. Teste primeiro em homologacao.');
  }

  return { errors, warnings };
}

async function getNextNFCeNumber(supabase: any, userId: string, serie: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_next_nfce_number', { p_user_id: userId, p_serie: serie });
  if (error) throw new Error(`Erro ao gerar numero da NFC-e: ${error.message}`);
  return Number(data);
}

async function generateAccessKey(supabase: any, fiscalSettings: any, numero: number, dataEmissao: Date): Promise<string> {
  const parts = getNfeDateParts(dataEmissao);
  const aamm = `${parts.year.slice(-2)}${parts.month}`;
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

function normalizeTaxCst(value: string, fallback = '07') {
  return String(value || fallback).replace(/\D/g, '').padStart(2, '0').slice(0, 2) || fallback;
}

function buildPisXml(item: any) {
  const cst = normalizeTaxCst(item.cst_pis);
  if (['01', '02'].includes(cst)) {
    return `<PIS><PISAliq><CST>${cst}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISAliq></PIS>`;
  }
  if (cst === '03') {
    return `<PIS><PISQtde><CST>03</CST><qBCProd>0.0000</qBCProd><vAliqProd>0.0000</vAliqProd><vPIS>0.00</vPIS></PISQtde></PIS>`;
  }
  if (['04', '06', '07', '08', '09'].includes(cst)) {
    return `<PIS><PISNT><CST>${cst}</CST></PISNT></PIS>`;
  }
  return `<PIS><PISOutr><CST>${cst}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`;
}

function buildCofinsXml(item: any) {
  const cst = normalizeTaxCst(item.cst_cofins);
  if (['01', '02'].includes(cst)) {
    return `<COFINS><COFINSAliq><CST>${cst}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSAliq></COFINS>`;
  }
  if (cst === '03') {
    return `<COFINS><COFINSQtde><CST>03</CST><qBCProd>0.0000</qBCProd><vAliqProd>0.0000</vAliqProd><vCOFINS>0.00</vCOFINS></COFINSQtde></COFINS>`;
  }
  if (['04', '06', '07', '08', '09'].includes(cst)) {
    return `<COFINS><COFINSNT><CST>${cst}</CST></COFINSNT></COFINS>`;
  }
  return `<COFINS><COFINSOutr><CST>${cst}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`;
}

function generateNFCeXML(input: {
  fiscalSettings: any;
  cupom: any;
  order: any;
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
    order,
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
  const codigoMunicipio = resolveMunicipalityCode(fiscalSettings);
  const consumidorDoc = onlyDigits(consumerData?.cpf_cnpj);
  const detXml = items.map((item, index) => {
    const productName = isHomologacao && index === 0
      ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : item.descricao;
    return `<det nItem="${index + 1}"><prod><cProd>${escapeXml(item.codigo_produto)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${escapeXml(productName)}</xProd><NCM>${item.ncm}</NCM><CFOP>${item.cfop}</CFOP><uCom>${escapeXml(item.unidade)}</uCom><qCom>${fixed4(item.quantidade)}</qCom><vUnCom>${fixed4(item.valor_unitario)}</vUnCom><vProd>${fixed2(item.valor_total)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${escapeXml(item.unidade)}</uTrib><qTrib>${fixed4(item.quantidade)}</qTrib><vUnTrib>${fixed4(item.valor_unitario)}</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>${fixed2(item.valor_total * 0.0765)}</vTotTrib><ICMS><ICMSSN102><orig>0</orig><CSOSN>${item.cst_icms}</CSOSN></ICMSSN102></ICMS>${buildPisXml(item)}${buildCofinsXml(item)}</imposto></det>`;
  }).join('');

  const destXml = consumidorDoc
    ? `<dest>${consumidorDoc.length === 11 ? `<CPF>${consumidorDoc}</CPF>` : `<CNPJ>${consumidorDoc}</CNPJ>`}${consumerData?.nome ? `<xNome>${escapeXml(consumerData.nome)}</xNome>` : ''}<indIEDest>9</indIEDest></dest>`
    : '';
  const paymentXml = buildPaymentDetailsXml(order, paymentMethod, valorTotal);

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${cupom.chave_acesso}" versao="4.00"><ide><cUF>${getCodigoUF(fiscalSettings.endereco_uf)}</cUF><cNF>${cupom.chave_acesso.substring(35, 43)}</cNF><natOp>Venda</natOp><mod>65</mod><serie>${Number(cupom.serie)}</serie><nNF>${cupom.numero}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>${codigoMunicipio}</cMunFG><tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>${cupom.chave_acesso.slice(-1)}</cDV><tpAmb>${isHomologacao ? '2' : '1'}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>PopSystem-1.0</verProc></ide><emit><CNPJ>${onlyDigits(fiscalSettings.cnpj)}</CNPJ><xNome>${escapeXml(fiscalSettings.razao_social)}</xNome><xFant>${escapeXml(fiscalSettings.nome_fantasia || fiscalSettings.razao_social)}</xFant><enderEmit><xLgr>${escapeXml(fiscalSettings.endereco_logradouro)}</xLgr><nro>${escapeXml(fiscalSettings.endereco_numero)}</nro>${fiscalSettings.endereco_complemento ? `<xCpl>${escapeXml(fiscalSettings.endereco_complemento)}</xCpl>` : ''}<xBairro>${escapeXml(fiscalSettings.endereco_bairro)}</xBairro><cMun>${codigoMunicipio}</cMun><xMun>${escapeXml(fiscalSettings.endereco_municipio)}</xMun><UF>${escapeXml(fiscalSettings.endereco_uf)}</UF><CEP>${onlyDigits(fiscalSettings.endereco_cep)}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>${escapeXml(fiscalSettings.inscricao_estadual || 'ISENTO')}</IE><CRT>${Number(fiscalSettings.regime_tributario || 1)}</CRT></emit>${destXml}${detXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${fixed2(totalProdutos)}</vProd><vFrete>${fixed2(deliveryFee)}</vFrete><vSeg>0.00</vSeg><vDesc>${fixed2(valorDesconto)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${fixed2(valorTotal)}</vNF><vTotTrib>${fixed2(valorTributos)}</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag>${paymentXml}</pag>${observacoes ? `<infAdic><infCpl>${escapeXml(observacoes)}</infCpl></infAdic>` : ''}</infNFe></NFe>`;
}

function buildPaymentDetailsXml(order: any, paymentMethod: string, valorTotal: number): string {
  const lines = normalizeFiscalPaymentLines(order, paymentMethod, valorTotal);
  return lines.map((line: { method: string; amount: number }) => {
    const tPag = mapPaymentMethod(line.method);
    const cardXml = buildPaymentCardXml(tPag, order, line.method);
    return `<detPag><indPag>0</indPag><tPag>${tPag}</tPag><vPag>${fixed2(line.amount)}</vPag>${cardXml}</detPag>`;
  }).join('');
}

function normalizeFiscalPaymentLines(order: any, paymentMethod: string, valorTotal: number): Array<{ method: string; amount: number }> {
  const splitLines = Array.isArray(order?.variations?.payment_split?.lines)
    ? order.variations.payment_split.lines
    : [];

  const validSplitLines = splitLines
    .map((line: any) => ({
      method: normalizeFiscalPaymentMethod(line?.method || line?.label || paymentMethod),
      amount: money(Number(line?.amount || 0)),
    }))
    .filter((line: any) => line.amount > 0);

  if (validSplitLines.length > 0) return validSplitLines;

  return [{
    method: normalizeFiscalPaymentMethod(paymentMethod),
    amount: money(valorTotal),
  }];
}

function normalizeFiscalPaymentMethod(method: string): string {
  const normalized = normalizeTextKey(String(method || '')).replace(/[^A-Z0-9]/g, '_');
  if (normalized.includes('PIX')) return normalized.includes('ONLINE') ? 'pix_online' : 'pix';
  if (normalized.includes('DEBITO') || normalized.includes('DEBIT')) return 'cartao_debito';
  if (normalized.includes('CREDITO') || normalized.includes('CREDIT')) return 'cartao_credito';
  if (normalized.includes('CARTAO') || normalized.includes('CARD')) return 'cartao_credito';
  if (normalized.includes('DINHEIRO') || normalized.includes('CASH')) return 'dinheiro';
  return String(method || '');
}

function buildPaymentCardXml(tPag: string, order: any, method: string): string {
  if (!['03', '04', '17'].includes(tPag)) return '';

  if (tPag === '17') {
    return '<card><tpIntegra>2</tpIntegra></card>';
  }

  const tef = order?.variations?.tef || {};
  const acquirerCnpj = onlyDigits(tef?.acquirer_cnpj || tef?.cnpj || '');
  const authorizationCode = String(tef?.auth || tef?.authorization_code || tef?.cAut || '').trim();
  const brandCode = mapCardBrand(tef?.brand);

  if (acquirerCnpj.length === 14 && authorizationCode && ['03', '04'].includes(tPag)) {
    return `<card><tpIntegra>1</tpIntegra><CNPJ>${acquirerCnpj}</CNPJ>${brandCode ? `<tBand>${brandCode}</tBand>` : ''}<cAut>${escapeXml(authorizationCode).slice(0, 128)}</cAut></card>`;
  }

  return '<card><tpIntegra>2</tpIntegra></card>';
}

function mapCardBrand(value: unknown): string {
  const brand = normalizeTextKey(String(value || ''));
  if (!brand) return '';
  if (brand.includes('VISA')) return '01';
  if (brand.includes('MASTER')) return '02';
  if (brand.includes('AMERICAN') || brand.includes('AMEX')) return '03';
  if (brand.includes('SOROCRED')) return '04';
  if (brand.includes('DINERS')) return '05';
  if (brand.includes('ELO')) return '06';
  if (brand.includes('HIPER')) return '07';
  if (brand.includes('AURA')) return '08';
  if (brand.includes('CABAL')) return '09';
  return '99';
}

function mapPaymentMethod(method: string): string {
  const normalized = normalizeFiscalPaymentMethod(method);
  if (normalized.includes('pix')) return '17';
  if (normalized.includes('cartao_debito')) return '04';
  if (normalized.includes('cartao_credito')) return '03';
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
  const normalizedUf = String(uf || '').toUpperCase();
  const codigo = codigos[normalizedUf];
  if (!codigo) throw new Error(`UF fiscal invalida ou nao suportada: ${uf || '(vazia)'}`);
  return codigo;
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

function getNfeDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: NFE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: parts.year || String(date.getUTCFullYear()),
    month: parts.month || String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: parts.day || String(date.getUTCDate()).padStart(2, '0'),
    hour: parts.hour === '24' ? '00' : (parts.hour || '00'),
    minute: parts.minute || '00',
    second: parts.second || '00',
  };
}

function formatNfeDate(date: Date): string {
  const parts = getNfeDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

function normalizeTextKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function resolveMunicipalityCode(settings: any): string {
  const raw = onlyDigits(settings?.codigo_municipio);
  if (raw.length === 7) return raw;
  const uf = String(settings?.endereco_uf || '').toUpperCase();
  const city = normalizeTextKey(settings?.endereco_municipio);
  return MUNICIPALITY_CODE_OVERRIDES[`${uf}|${city}`] || raw;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}
