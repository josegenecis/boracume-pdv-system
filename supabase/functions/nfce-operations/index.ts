
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

  // 7. Gerar XML da NFC-e
  const xmlContent = await generateNFCeXML(fiscalSettings, cupom, items, data.consumer_data, data.observacoes);

  // 8. Simular envio para Sefaz (em produção, aqui seria feita a comunicação real)
  const transmissionResult = await simulateTransmissionToSefaz(xmlContent, fiscalSettings.ambiente);

  // 9. Atualizar cupom com resultado da transmissão
  const updateData: any = {
    xml_content: xmlContent,
    status: transmissionResult.success ? 'autorizado' : 'rejeitado',
    updated_at: new Date().toISOString()
  };

  if (transmissionResult.success) {
    updateData.protocolo_autorizacao = transmissionResult.protocolo;
    updateData.data_hora_autorizacao = new Date().toISOString();
    updateData.xml_autorizado = transmissionResult.xmlAutorizado;
    updateData.qr_code_url = generateQRCodeURL(chaveAcesso, fiscalSettings.endereco_uf);
  } else {
    updateData.motivo_rejeicao = transmissionResult.motivo;
  }

  const { error: updateError } = await supabase
    .from('nfce_cupons')
    .update(updateData)
    .eq('id', cupom.id);

  if (updateError) {
    console.error('Erro ao atualizar cupom:', updateError);
  }

  // 10. Registrar log de transmissão
  await supabase
    .from('nfce_transmissions')
    .insert([{
      cupom_id: cupom.id,
      tipo_operacao: 'emissao',
      xml_enviado: xmlContent,
      xml_retorno: transmissionResult.xmlRetorno,
      codigo_status: transmissionResult.codigoStatus,
      motivo: transmissionResult.motivo,
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

  // Simular consulta na Sefaz
  const consultaResult = await simulateConsultationSefaz(cupom.chave_acesso);

  // Atualizar status se necessário
  if (consultaResult.status !== cupom.status) {
    await supabase
      .from('nfce_cupons')
      .update({
        status: consultaResult.status,
        protocolo_autorizacao: consultaResult.protocolo,
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
      codigo_status: consultaResult.codigoStatus,
      protocolo: consultaResult.protocolo,
      sucesso: true
    }]);

  return new Response(
    JSON.stringify({
      success: true,
      status: consultaResult.status,
      protocolo: consultaResult.protocolo
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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

  // Simular cancelamento na Sefaz
  const cancelResult = await simulateCancellationSefaz(cupom.chave_acesso, motivo);

  if (cancelResult.success) {
    // Atualizar status do cupom
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
      codigo_status: cancelResult.codigoStatus,
      motivo: motivo,
      protocolo: cancelResult.protocolo,
      sucesso: cancelResult.success
    }]);

  return new Response(
    JSON.stringify({
      success: cancelResult.success,
      motivo: cancelResult.success ? 'Cancelado com sucesso' : cancelResult.motivo
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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

function generateQRCodeURL(chaveAcesso: string, uf: string): string {
  // URL do QR Code para consulta pelo consumidor
  const baseUrl = `https://www.sefaz.${uf.toLowerCase()}.gov.br/nfce/consulta`;
  return `${baseUrl}?chave=${chaveAcesso}`;
}

async function generateNFCeXML(
  fiscalSettings: any,
  cupom: any,
  items: any[],
  consumerData?: any,
  observacoes?: string
): Promise<string> {
  // Esta é uma versão simplificada. Em produção, usar biblioteca específica para gerar XML conforme layout da Sefaz
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${cupom.chave_acesso}">
      <ide>
        <cUF>${getCodigoUF(fiscalSettings.endereco_uf)}</cUF>
        <cNF>${cupom.numero.toString().padStart(8, '0')}</cNF>
        <natOp>Venda</natOp>
        <mod>65</mod>
        <serie>${cupom.serie}</serie>
        <nNF>${cupom.numero}</nNF>
        <dhEmi>${cupom.data_hora_emissao}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>${fiscalSettings.codigo_municipio}</cMunFG>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${cupom.chave_acesso.slice(-1)}</cDV>
        <tpAmb>${fiscalSettings.ambiente === 'producao' ? '1' : '2'}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
      </ide>
      <emit>
        <CNPJ>${fiscalSettings.cnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${fiscalSettings.razao_social}</xNome>
        <enderEmit>
          <xLgr>${fiscalSettings.endereco_logradouro}</xLgr>
          <nro>${fiscalSettings.endereco_numero}</nro>
          <xBairro>${fiscalSettings.endereco_bairro}</xBairro>
          <cMun>${fiscalSettings.codigo_municipio}</cMun>
          <xMun>${fiscalSettings.endereco_municipio}</xMun>
          <UF>${fiscalSettings.endereco_uf}</UF>
          <CEP>${fiscalSettings.endereco_cep.replace(/\D/g, '')}</CEP>
        </enderEmit>
        <IE>${fiscalSettings.inscricao_estadual || ''}</IE>
        <CRT>${fiscalSettings.regime_tributario}</CRT>
      </emit>
      ${consumerData?.cpf_cnpj ? `
      <dest>
        ${consumerData.cpf_cnpj.length === 11 ? 
          `<CPF>${consumerData.cpf_cnpj}</CPF>` : 
          `<CNPJ>${consumerData.cpf_cnpj}</CNPJ>`
        }
        ${consumerData.nome ? `<xNome>${consumerData.nome}</xNome>` : ''}
      </dest>
      ` : ''}
      ${items.map((item, index) => `
      <det nItem="${index + 1}">
        <prod>
          <cProd>${item.codigo_produto}</cProd>
          <cEAN />
          <xProd>${item.descricao}</xProd>
          <NCM>${item.ncm}</NCM>
          <CFOP>${item.cfop}</CFOP>
          <uCom>${item.unidade}</uCom>
          <qCom>${item.quantidade}</qCom>
          <vUnCom>${item.valor_unitario.toFixed(4)}</vUnCom>
          <vProd>${item.valor_total.toFixed(2)}</vProd>
          <cEANTrib />
          <uTrib>${item.unidade}</uTrib>
          <qTrib>${item.quantidade}</qTrib>
          <vUnTrib>${item.valor_unitario.toFixed(4)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
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
          <tPag>01</tPag>
          <vPag>${cupom.valor_total.toFixed(2)}</vPag>
        </detPag>
      </pag>
      ${observacoes ? `<infAdic><infCpl>${observacoes}</infCpl></infAdic>` : ''}
    </infNFe>
  </NFe>
</nfeProc>`;

  return xml;
}

async function simulateTransmissionToSefaz(xml: string, ambiente: string) {
  // Simular comunicação com Sefaz - em produção usar bibliotecas específicas
  console.log('Simulando transmissão para Sefaz no ambiente:', ambiente);
  
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Simular sucesso na maioria dos casos
  const success = Math.random() > 0.1; // 90% de sucesso
  
  if (success) {
    return {
      success: true,
      protocolo: `${ambiente === 'producao' ? '1' : '2'}${Date.now().toString().slice(-8)}`,
      codigoStatus: '100',
      motivo: 'Autorizado o uso da NFC-e',
      xmlRetorno: '<retEnviNFe>...</retEnviNFe>',
      xmlAutorizado: xml // Em produção, seria o XML retornado pela Sefaz
    };
  } else {
    return {
      success: false,
      protocolo: null,
      codigoStatus: '999',
      motivo: 'Erro de simulação - teste de rejeição',
      xmlRetorno: '<retEnviNFe><cStat>999</cStat><xMotivo>Erro de simulação</xMotivo></retEnviNFe>',
      xmlAutorizado: null
    };
  }
}

async function simulateConsultationSefaz(chaveAcesso: string) {
  console.log('Simulando consulta na Sefaz para chave:', chaveAcesso);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    status: 'autorizado',
    protocolo: `1${Date.now().toString().slice(-8)}`,
    codigoStatus: '100',
    xmlRetorno: '<retConsReciNFe>...</retConsReciNFe>'
  };
}

async function simulateCancellationSefaz(chaveAcesso: string, motivo: string) {
  console.log('Simulando cancelamento na Sefaz:', chaveAcesso, motivo);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    success: true,
    protocolo: `1${Date.now().toString().slice(-8)}`,
    codigoStatus: '101',
    motivo: 'Cancelamento homologado',
    xmlRetorno: '<retCancNFe>...</retCancNFe>'
  };
}
