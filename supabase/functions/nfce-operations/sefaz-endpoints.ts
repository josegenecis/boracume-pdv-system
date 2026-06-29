export type Ambiente = 'producao' | 'homologacao';
export type SefazOperation = 'autorizacao' | 'retAutorizacao' | 'consulta' | 'status' | 'evento';

export interface SefazResponse {
  success: boolean;
  cStat: string;
  xMotivo: string;
  protocolo?: string;
  recibo?: string;
  xmlRetorno: string;
  xmlEnviado?: string;
  digestValue?: string;
  qrCodeUrl?: string;
  chaveAcesso?: string;
  rawStatus?: string;
}

type EndpointSet = Record<SefazOperation, string>;

const SVRS_PROD: EndpointSet = {
  autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consulta: 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  status: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  evento: 'https://nfce.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
};

const SVRS_HOM: EndpointSet = {
  autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  retAutorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
  consulta: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  status: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  evento: 'https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
};

const ENDPOINTS: Record<Ambiente, Partial<Record<string, EndpointSet>>> = {
  producao: {
    SVRS: SVRS_PROD,
    AC: SVRS_PROD,
    AL: SVRS_PROD,
    AP: SVRS_PROD,
    CE: SVRS_PROD,
    DF: SVRS_PROD,
    ES: SVRS_PROD,
    MA: SVRS_PROD,
    PA: SVRS_PROD,
    PB: SVRS_PROD,
    PI: SVRS_PROD,
    RJ: SVRS_PROD,
    RN: SVRS_PROD,
    RO: SVRS_PROD,
    RR: SVRS_PROD,
    SC: SVRS_PROD,
    SE: SVRS_PROD,
    TO: SVRS_PROD,
    RS: {
      autorizacao: 'https://nfce.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfce.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfce.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      status: 'https://nfce.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      evento: 'https://nfce.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    },
    SP: {
      autorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      status: 'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      evento: 'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
    },
    PR: {
      autorizacao: 'https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
      retAutorizacao: 'https://nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4',
      consulta: 'https://nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4',
      status: 'https://nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
      evento: 'https://nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4',
    },
    AM: {
      autorizacao: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao',
      retAutorizacao: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao',
      consulta: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta2',
      status: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico2',
      evento: 'https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento',
    },
  },
  homologacao: {
    SVRS: SVRS_HOM,
    AC: SVRS_HOM,
    AL: SVRS_HOM,
    AP: SVRS_HOM,
    CE: SVRS_HOM,
    DF: SVRS_HOM,
    ES: SVRS_HOM,
    MA: SVRS_HOM,
    PA: SVRS_HOM,
    PB: SVRS_HOM,
    PI: SVRS_HOM,
    RJ: SVRS_HOM,
    RN: SVRS_HOM,
    RO: SVRS_HOM,
    RR: SVRS_HOM,
    SC: SVRS_HOM,
    SE: SVRS_HOM,
    TO: SVRS_HOM,
    RS: {
      autorizacao: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      status: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      evento: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    },
    SP: {
      autorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consulta: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      status: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      evento: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
    },
    PR: {
      autorizacao: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
      retAutorizacao: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4',
      consulta: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4',
      status: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
      evento: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4',
    },
    AM: {
      autorizacao: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao',
      retAutorizacao: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao',
      consulta: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta2',
      status: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico2',
      evento: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento',
    },
  },
};

export function getSefazEndpoint(uf: string, ambiente: Ambiente, operation: SefazOperation): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const endpoints = ENDPOINTS[ambiente]?.[normalizedUf] || ENDPOINTS[ambiente]?.SVRS;
  const endpoint = endpoints?.[operation];
  if (!endpoint) {
    throw new Error(`Endpoint NFC-e nao configurado para ${normalizedUf}/${ambiente}/${operation}`);
  }
  return endpoint;
}

export function getSoapNamespace(operation: SefazOperation): string {
  switch (operation) {
    case 'autorizacao':
      return 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
    case 'retAutorizacao':
      return 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4';
    case 'consulta':
      return 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4';
    case 'status':
      return 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
    case 'evento':
      return 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
  }
}

export function parseSefazResponse(xmlResponse: string): SefazResponse {
  const statuses = [...xmlResponse.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((match) => match[1]);
  const motives = [...xmlResponse.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map((match) => decodeXml(match[1]));
  const protocol = firstMatch(xmlResponse, /<nProt>([^<]+)<\/nProt>/);
  const receipt = firstMatch(xmlResponse, /<nRec>([^<]+)<\/nRec>/);
  const key = firstMatch(xmlResponse, /<chNFe>([^<]+)<\/chNFe>/);
  const lastStatus = statuses[statuses.length - 1] || '999';
  const lastMotive = motives[motives.length - 1] || 'Resposta da Sefaz sem motivo';

  return {
    success: ['100', '103', '104', '105', '107', '150', '135'].includes(lastStatus),
    cStat: lastStatus,
    rawStatus: statuses.join(','),
    xMotivo: lastMotive,
    protocolo: protocol,
    recibo: receipt,
    chaveAcesso: key,
    xmlRetorno: xmlResponse,
  };
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
