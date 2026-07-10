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

const OPERATION_ENV_KEYS: Record<SefazOperation, string> = {
  autorizacao: 'AUTORIZACAO',
  retAutorizacao: 'RET_AUTORIZACAO',
  consulta: 'CONSULTA',
  status: 'STATUS',
  evento: 'EVENTO',
};

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

const GO_PROD: EndpointSet = {
  autorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
  retAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
  consulta: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
  status: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
  evento: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
};

const GO_HOM: EndpointSet = {
  autorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
  retAutorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
  consulta: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
  status: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
  evento: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
};

const MT_PROD: EndpointSet = {
  autorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
  retAutorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
  consulta: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
  status: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
  evento: 'https://nfce.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
};

const MT_HOM: EndpointSet = {
  autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
  retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
  consulta: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
  status: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
  evento: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
};

const MS_PROD: EndpointSet = {
  autorizacao: 'https://nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
  retAutorizacao: 'https://nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
  consulta: 'https://nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
  status: 'https://nfce.sefaz.ms.gov.br/ws/NFeStatusServico4',
  evento: 'https://nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
};

const MS_HOM: EndpointSet = {
  autorizacao: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
  retAutorizacao: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
  consulta: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
  status: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeStatusServico4',
  evento: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
};

const MG_PROD: EndpointSet = {
  autorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  retAutorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  consulta: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  status: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  evento: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
};

const MG_HOM: EndpointSet = {
  autorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  retAutorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  consulta: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  status: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  evento: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
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
    BA: SVRS_PROD,
    PE: SVRS_PROD,
    GO: GO_PROD,
    MT: MT_PROD,
    MS: MS_PROD,
    MG: MG_PROD,
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
    BA: SVRS_HOM,
    PE: SVRS_HOM,
    GO: GO_HOM,
    MT: MT_HOM,
    MS: MS_HOM,
    MG: MG_HOM,
  },
};

export function getSefazEndpoint(uf: string, ambiente: Ambiente, operation: SefazOperation): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const override = getEndpointOverride(normalizedUf, ambiente, operation);
  if (override) return override;

  const endpoints = ENDPOINTS[ambiente]?.[normalizedUf];
  const endpoint = endpoints?.[operation];
  if (!endpoint) {
    const envKey = getEndpointEnvKey(normalizedUf, ambiente, operation);
    throw new Error(`Endpoint NFC-e nao configurado para ${normalizedUf}/${ambiente}/${operation}. Configure ${envKey} ou adicione a UF no mapa fiscal.`);
  }
  return sanitizeEndpointUrl(endpoint);
}

export function getConfiguredSefazUfs(ambiente: Ambiente): string[] {
  return Object.keys(ENDPOINTS[ambiente] || {}).filter((uf) => uf !== 'SVRS').sort();
}

export function hasSefazEndpoint(uf: string, ambiente: Ambiente, operation: SefazOperation): boolean {
  try {
    return Boolean(getSefazEndpoint(uf, ambiente, operation));
  } catch {
    return false;
  }
}

function getEndpointOverride(uf: string, ambiente: Ambiente, operation: SefazOperation): string {
  const value = Deno.env.get(getEndpointEnvKey(uf, ambiente, operation))?.trim();
  return value ? sanitizeEndpointUrl(value) : '';
}

function getEndpointEnvKey(uf: string, ambiente: Ambiente, operation: SefazOperation): string {
  return `NFCE_${ambiente.toUpperCase()}_${uf}_${OPERATION_ENV_KEYS[operation]}_URL`;
}

function sanitizeEndpointUrl(value: string): string {
  return String(value || '').trim().replace(/\?wsdl$/i, '');
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
