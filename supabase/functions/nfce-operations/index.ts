import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NFCeData {
  operation: 'emitir' | 'consultar' | 'cancelar' | 'download_xml';
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    const requestData: NFCeData = await req.json();
    console.log('NFC-e operation:', requestData.operation);

    switch (requestData.operation) {
      case 'emitir':
        return await emitirNFCe(supabase, user.id, requestData);
      case 'consultar':
        return await consultarNFCe(supabase, user.id, requestData.cupom_id!);
      case 'cancelar':
        return await cancelarNFCe(supabase, user.id, requestData.cupom_id!, requestData.motivo!);
      case 'download_xml':
        return await downloadXML(supabase, user.id, requestData.cupom_id!);
      default:
        throw new Error('Operação não suportada');
    }
  } catch (error) {
    console.error('Error in nfce-operations:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

import { loadCertificateFromBase64, validateCertificate } from './certificate-utils.ts';
import { SefazClient } from './sefaz-client.ts';
import { generateQRCodeData } from './qrcode-generator.ts';

async function emitirNFCe(supabase: any, userId: string, data: NFCeData) {
  console.log('Iniciando emissão de NFC-e para ordem:', data.order_id);

  // 1. Buscar configurações fiscais
  const { data: fiscalSettings, error: fiscalError } = await supabase
    .from('fiscal_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('ativo', true)
    .single();

  if (fiscalError || !fiscalSettings) {
    throw new Error('Configurações fiscais não encontradas ou inativas');
  }

  // 2. Buscar dados do pedido
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', data.order_id)
    .eq('user_id', userId)
    .single();

  if (orderError || !order) {
    throw new Error('Pedido não encontrado');
  }

  // Validar e carregar certificado
  if (!fiscalSettings.certificado_a1_base64 || !fiscalSettings.certificado_senha) {
    throw new Error('Certificado digital A1 não configurado');
  }

  let certInfo;
  let sefazClient;
  
  try {
    console.log('Carregando certificado digital...');
    certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
    
    const validation = validateCertificate(certInfo);
    if (!validation.valid) {
      throw new Error(`Certificado inválido: ${validation.errors.join(', ')}`);
    }
    
    sefazClient = new SefazClient(certInfo);
    console.log('Certificado carregado e validado com sucesso');
  } catch (error) {
    console.error('Erro ao carregar certificado:', error);
    throw new Error(`Erro no certificado: ${error.message}`);
  }

  // 3. Gerar próximo número da NFC-e
  const { data: numeroResult, error: numeroError } = await supabase
    .rpc('get_next_nfce_number', {
      p_user_id: userId,
      p_serie: fiscalSettings.nfce_serie
    });

  if (numeroError) {
    throw new Error('Erro ao gerar número da NFC-e: ' + numeroError.message);
  }

  const numeroNFCe = numeroResult;

  // 4. Gerar chave de acesso
  const dataEmissao = new Date();
  const aamm = dataEmissao.getFullYear().toString().slice(-2) + 
               (dataEmissao.getMonth() + 1).toString().padStart(2, '0');
  
  const codigoNumerico = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  
  const { data: chaveAcesso, error: chaveError } = await supabase
    .rpc('generate_nfce_access_key', {
      p_uf: getCodigoUF(fiscalSettings.endereco_uf),
      p_aamm: aamm,
      p_cnpj: fiscalSettings.cnpj.replace(/\D/g, ''),
      p_modelo: '65', // Modelo 65 = NFC-e
      p_serie: fiscalSettings.nfce_serie,
      p_numero: numeroNFCe.toString(),
      p_tipo_emissao: '1', // Normal
      p_codigo_numerico: codigoNumerico
    });

  if (chaveError) {
    throw new Error('Erro ao gerar chave de acesso: ' + chaveError.message);
  }

  // 5. Criar registro do cupom
  const cupomData = {
    user_id: userId,
    order_id: data.order_id,
    numero: numeroNFCe,
    serie: fiscalSettings.nfce_serie,
    chave_acesso: chaveAcesso,
    valor_total: order.total,
    valor_desconto: 0,
    valor_tributos: calculateTaxes(order.total),
    consumidor_nome: data.consumer_data?.nome || null,
    consumidor_cpf_cnpj: data.consumer_data?.cpf_cnpj || null,
    status: 'pendente',
    contingencia: false,
    data_hora_emissao: dataEmissao.toISOString()
  };

  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .insert([cupomData])
    .select()
    .single();

  if (cupomError) {
    throw new Error('Erro ao criar cupom: ' + cupomError.message);
  }

  // 6. Criar itens do cupom
  const items = order.items.map((item: any, index: number) => ({
    cupom_id: cupom.id,
    product_id: item.product_id || null,
    codigo_produto: item.product_id || (index + 1).toString().padStart(6, '0'),
    descricao: item.name,
    ncm: '00000000', // NCM genérico - deveria vir do produto
    cfop: '5102', // Venda no estado
    unidade: 'UN',
    quantidade: item.quantity,
    valor_unitario: item.price,
    valor_total: item.price * item.quantity,
    valor_desconto: 0,
    cst_icms: '102', // Simples Nacional - sem tributação
    aliquota_icms: 0,
    valor_icms: 0,
    cst_pis: '07', // Isento
    aliquota_pis: 0,
    valor_pis: 0,
    cst_cofins: '07', // Isento
    aliquota_cofins: 0,
    valor_cofins: 0
  }));

  const { error: itemsError } = await supabase
    .from('nfce_items')
    .insert(items);

  if (itemsError) {
    throw new Error('Erro ao criar itens do cupom: ' + itemsError.message);
  }

  // 7. Gerar XML da NFC-e (versão real)
  const xmlContent = await generateNFCeXMLReal(fiscalSettings, cupom, items, data.consumer_data, data.observacoes);

  // 8. Enviar para Sefaz usando bibliotecas reais
  console.log('Enviando NFC-e para Sefaz...');
  const transmissionResult = await sefazClient.enviarNFCe(
    xmlContent, 
    fiscalSettings.endereco_uf,
    fiscalSettings.ambiente as 'producao' | 'homologacao'
  );

  // 9. Gerar QR Code real se autorizado
  let qrCodeUrl = '';
  if (transmissionResult.success && transmissionResult.chaveAcesso) {
    qrCodeUrl = generateQRCodeData(
      transmissionResult.chaveAcesso,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as 'producao' | 'homologacao',
      cupom.data_hora_emissao,
      cupom.valor_total,
      data.consumer_data?.cpf_cnpj,
      fiscalSettings.csc_id,
      fiscalSettings.csc_token
    );
  }

  // 10. Atualizar cupom com resultado da transmissão
  const updateData: any = {
    xml_content: xmlContent,
    status: transmissionResult.success ? 'autorizado' : 'rejeitado',
    updated_at: new Date().toISOString()
  };

  if (transmissionResult.success) {
    updateData.protocolo_autorizacao = transmissionResult.protocolo;
    updateData.data_hora_autorizacao = new Date().toISOString();
    updateData.xml_autorizado = transmissionResult.xmlRetorno;
    updateData.qr_code_url = qrCodeUrl;
  } else {
    updateData.motivo_rejeicao = transmissionResult.xMotivo;
  }

  // Atualizar com QR Code real
  if (qrCodeUrl) {
    updateData.qr_code_url = qrCodeUrl;
  }

  const { error: updateError } = await supabase
    .from('nfce_cupons')
    .update(updateData)
    .eq('id', cupom.id);

  if (updateError) {
    console.error('Erro ao atualizar cupom:', updateError);
  }

  // 11. Registrar log de transmissão
  await supabase
    .from('nfce_transmissions')
    .insert([{
      cupom_id: cupom.id,
      tipo_operacao: 'emissao',
      xml_enviado: xmlContent,
      xml_retorno: transmissionResult.xmlRetorno,
      codigo_status: transmissionResult.cStat,
      motivo: transmissionResult.xMotivo,
      protocolo: transmissionResult.protocolo,
      sucesso: transmissionResult.success
    }]);

  return new Response(
    JSON.stringify({
      success: true,
      cupom_id: cupom.id,
      numero: numeroNFCe,
      chave_acesso: chaveAcesso,
      status: updateData.status,
      protocolo: transmissionResult.protocolo
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function consultarNFCe(supabase: any, userId: string, cupomId: string) {
  console.log('Consultando NFC-e:', cupomId);

  // Buscar cupom
  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .select('*')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();

  if (cupomError || !cupom) {
    throw new Error('Cupom não encontrado');
  }

  // Carregar certificado e criar cliente Sefaz
  const { data: fiscalSettings, error: fiscalError } = await supabase
    .from('fiscal_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fiscalError || !fiscalSettings) {
    throw new Error('Configurações fiscais não encontradas');
  }

  try {
    const certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
    const sefazClient = new SefazClient(certInfo);
    
    // Consultar real na Sefaz
    const consultaResult = await sefazClient.consultarNFCe(
      cupom.chave_acesso,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as 'producao' | 'homologacao'
    );

    // Atualizar status se necessário
    if (consultaResult.success && consultaResult.cStat !== cupom.status) {
      await supabase
        .from('nfce_cupons')
        .update({
          status: consultaResult.success ? 'autorizado' : 'rejeitado',
          protocolo_autorizacao: consultaResult.protocolo,
          motivo_rejeicao: consultaResult.xMotivo,
          updated_at: new Date().toISOString()
        })
        .eq('id', cupomId);
    }

    // Registrar log de consulta
    await supabase
      .from('nfce_transmissions')
      .insert([{
        cupom_id: cupomId,
        tipo_operacao: 'consulta',
        xml_retorno: consultaResult.xmlRetorno,
        codigo_status: consultaResult.cStat,
        protocolo: consultaResult.protocolo,
        sucesso: consultaResult.success
      }]);
    
    return new Response(
      JSON.stringify({
        success: true,
        status: consultaResult.success ? 'autorizado' : cupom.status,
        protocolo: consultaResult.protocolo,
        motivo: consultaResult.xMotivo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na consulta real:', error);
    throw new Error(`Erro ao consultar NFC-e: ${error.message}`);
  }
}

async function cancelarNFCe(supabase: any, userId: string, cupomId: string, motivo: string) {
  console.log('Cancelando NFC-e:', cupomId);

  // Buscar cupom
  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .select('*')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();

  if (cupomError || !cupom) {
    throw new Error('Cupom não encontrado');
  }

  if (cupom.status !== 'autorizado') {
    throw new Error('Apenas cupons autorizados podem ser cancelados');
  }

  // Carregar certificado e criar cliente Sefaz
  const { data: fiscalSettings, error: fiscalError } = await supabase
    .from('fiscal_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fiscalError || !fiscalSettings) {
    throw new Error('Configurações fiscais não encontradas');
  }

  try {
    const certInfo = loadCertificateFromBase64(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
    const sefazClient = new SefazClient(certInfo);
    
    // Cancelar real na Sefaz
    const cancelResult = await sefazClient.cancelarNFCe(
      cupom.chave_acesso,
      cupom.protocolo_autorizacao,
      motivo,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as 'producao' | 'homologacao'
    );

    // Atualizar status do cupom
    if (cancelResult.success) {
      await supabase
        .from('nfce_cupons')
        .update({
          status: 'cancelado',
          updated_at: new Date().toISOString()
        })
        .eq('id', cupomId);
    }

    // Registrar log de cancelamento
    await supabase
      .from('nfce_transmissions')
      .insert([{
        cupom_id: cupomId,
        tipo_operacao: 'cancelamento',
        xml_retorno: cancelResult.xmlRetorno,
        codigo_status: cancelResult.cStat,
        motivo: motivo,
        protocolo: cancelResult.protocolo,
        sucesso: cancelResult.success
      }]);
    
    return new Response(
      JSON.stringify({
        success: cancelResult.success,
        motivo: cancelResult.success ? 'Cancelado com sucesso' : cancelResult.xMotivo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro no cancelamento real:', error);
    throw new Error(`Erro ao cancelar NFC-e: ${error.message}`);
  }
}

async function downloadXML(supabase: any, userId: string, cupomId: string) {
  // Buscar cupom
  const { data: cupom, error: cupomError } = await supabase
    .from('nfce_cupons')
    .select('xml_autorizado, xml_content, numero')
    .eq('id', cupomId)
    .eq('user_id', userId)
    .single();

  if (cupomError || !cupom) {
    throw new Error('Cupom não encontrado');
  }

  const xml = cupom.xml_autorizado || cupom.xml_content;
  if (!xml) {
    throw new Error('XML não disponível para este cupom');
  }

  return new Response(
    JSON.stringify({ xml }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Funções auxiliares

function getCodigoUF(uf: string): string {
  const codigos: { [key: string]: string } = {
    'AC': '12', 'AL': '17', 'AP': '16', 'AM': '23', 'BA': '29',
    'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
    'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
    'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
    'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
    'SE': '28', 'TO': '17'
  };
  return codigos[uf] || '35';
}

function calculateTaxes(total: number): number {
  // Cálculo simplificado de impostos aproximados
  return total * 0.0765; // Aproximadamente 7.65% para Simples Nacional
}

async function generateNFCeXMLReal(
  fiscalSettings: any,
  cupom: any,
  items: any[],
  consumerData?: any,
  observacoes?: string
): Promise<string> {
  // XML mais completo e conforme especificação real da Receita Federal
  const dataEmissao = new Date(cupom.data_hora_emissao);
  const dhEmi = dataEmissao.toISOString().replace(/\.\d{3}Z$/, '-03:00');
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${cupom.chave_acesso}" versao="4.00">
    <ide>
      <cUF>${getCodigoUF(fiscalSettings.endereco_uf)}</cUF>
      <cNF>${cupom.chave_acesso.substring(35, 43)}</cNF>
      <natOp>Venda</natOp>
      <mod>65</mod>
      <serie>${cupom.serie}</serie>
      <nNF>${cupom.numero}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${consumerData?.cpf_cnpj ? '1' : '0'}</idDest>
      <cMunFG>${fiscalSettings.codigo_municipio}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cupom.chave_acesso.slice(-1)}</cDV>
      <tpAmb>${fiscalSettings.ambiente === 'producao' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0.0</verProc>
    </ide>
    <emit>
      <CNPJ>${fiscalSettings.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${fiscalSettings.razao_social}</xNome>
      <xFant>${fiscalSettings.nome_fantasia || fiscalSettings.razao_social}</xFant>
      <enderEmit>
        <xLgr>${fiscalSettings.endereco_logradouro}</xLgr>
        <nro>${fiscalSettings.endereco_numero}</nro>
        ${fiscalSettings.endereco_complemento ? `<xCpl>${fiscalSettings.endereco_complemento}</xCpl>` : ''}
        <xBairro>${fiscalSettings.endereco_bairro}</xBairro>
        <cMun>${fiscalSettings.codigo_municipio}</cMun>
        <xMun>${fiscalSettings.endereco_municipio}</xMun>
        <UF>${fiscalSettings.endereco_uf}</UF>
        <CEP>${fiscalSettings.endereco_cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      ${fiscalSettings.inscricao_estadual ? `<IE>${fiscalSettings.inscricao_estadual}</IE>` : '<IE>ISENTO</IE>'}
      <CRT>${fiscalSettings.regime_tributario}</CRT>
    </emit>
    ${consumerData?.cpf_cnpj ? `
    <dest>
      ${consumerData.cpf_cnpj.replace(/\D/g, '').length === 11 ? 
        `<CPF>${consumerData.cpf_cnpj.replace(/\D/g, '')}</CPF>` : 
        `<CNPJ>${consumerData.cpf_cnpj.replace(/\D/g, '')}</CNPJ>`
      }
      ${consumerData.nome ? `<xNome>${consumerData.nome}</xNome>` : ''}
      <indIEDest>9</indIEDest>
    </dest>
    ` : ''}
    ${items.map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo_produto}</cProd>
        <cEAN/>
        <xProd>${item.descricao}</xProd>
        <NCM>${item.ncm}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${item.quantidade.toFixed(4)}</qCom>
        <vUnCom>${item.valor_unitario.toFixed(4)}</vUnCom>
        <vProd>${item.valor_total.toFixed(2)}</vProd>
        <cEANTrib/>
        <uTrib>${item.unidade}</uTrib>
        <qTrib>${item.quantidade.toFixed(4)}</qTrib>
        <vUnTrib>${item.valor_unitario.toFixed(4)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${(item.valor_total * 0.0765).toFixed(2)}</vTotTrib>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>${item.cst_icms}</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISOutr>
            <CST>${item.cst_pis}</CST>
            <vBC>0.00</vBC>
            <pPIS>0.0000</pPIS>
            <vPIS>0.00</vPIS>
          </PISOutr>
        </PIS>
        <COFINS>
          <COFINSOutr>
            <CST>${item.cst_cofins}</CST>
            <vBC>0.00</vBC>
            <pCOFINS>0.0000</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSOutr>
        </COFINS>
      </imposto>
    </det>
    `).join('')}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${cupom.valor_total.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${cupom.valor_total.toFixed(2)}</vNF>
        <vTotTrib>${cupom.valor_tributos.toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <indPag>0</indPag>
        <tPag>01</tPag>
        <vPag>${cupom.valor_total.toFixed(2)}</vPag>
      </detPag>
    </pag>
    ${observacoes ? `<infAdic><infCpl>${observacoes}</infCpl></infAdic>` : ''}
    <infRespTec>
      <CNPJ>00000000000000</CNPJ>
      <xContato>Suporte Técnico</xContato>
      <email>suporte@exemplo.com</email>
      <fone>1133334444</fone>
    </infRespTec>
  </infNFe>
</NFe>`;

  return xml;
}

function generateQRCodeURL(chaveAcesso: string, uf: string): string {
  // URL do QR Code para consulta pelo consumidor
  const baseUrl = `https://www.sefaz.${uf.toLowerCase()}.gov.br/nfce/consulta`;
  return `${baseUrl}?chave=${chaveAcesso}`;
}
