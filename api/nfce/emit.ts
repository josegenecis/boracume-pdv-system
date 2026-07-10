import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { createClient } from '@supabase/supabase-js';
import { requestSefazSoap } from './test-connection.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://auth.popsystem.com.br';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

type Ambiente = 'producao' | 'homologacao';

const AUTH_ENDPOINTS: Record<Ambiente, Record<string, string>> = {
  producao: {
    SVRS: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    CE: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    RS: 'https://nfce.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    SP: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    PR: 'https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
    AM: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao',
    GO: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    MT: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
    MS: 'https://nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
    MG: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  },
  homologacao: {
    SVRS: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    CE: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    RS: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    SP: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
    PR: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
    AM: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao',
    GO: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    MT: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
    MS: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
    MG: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  },
};

const SVRS_UFS = ['AC', 'AL', 'AP', 'BA', 'DF', 'ES', 'MA', 'PA', 'PB', 'PE', 'PI', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'];

for (const uf of SVRS_UFS) {
  AUTH_ENDPOINTS.producao[uf] = AUTH_ENDPOINTS.producao.SVRS;
  AUTH_ENDPOINTS.homologacao[uf] = AUTH_ENDPOINTS.homologacao.SVRS;
}

const CODIGO_UF: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
  MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
  RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};
const QR_CODE_URLS: Record<Ambiente, Record<string, string>> = {
  producao: {
    AC: 'http://www.sefaznet.ac.gov.br/nfce/qrcode',
    AL: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp',
    AP: 'https://www.sefaz.ap.gov.br/nfce/nfcep.php',
    AM: 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
    BA: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
    CE: 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html',
    DF: 'http://www.fazenda.df.gov.br/nfce/qrcode',
    ES: 'http://app.sefaz.es.gov.br/ConsultaNFCe',
    GO: 'https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
    MA: 'http://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp',
    MT: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
    MS: 'http://www.dfe.ms.gov.br/nfce/qrcode',
    MG: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    PA: 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam',
    PB: 'http://www.sefaz.pb.gov.br/nfce',
    PR: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
    PE: 'http://nfce.sefaz.pe.gov.br/nfce/consulta',
    PI: 'http://www.sefaz.pi.gov.br/nfce/qrcode',
    RJ: 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode',
    RN: 'https://nfce.set.rn.gov.br/consultarNFCe.aspx',
    RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    RO: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp',
    RR: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode',
    SC: 'https://sat.sef.sc.gov.br/nfce/consulta',
    SP: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
    SE: 'http://www.nfce.se.gov.br/nfce/consulta',
    TO: 'http://www.sefaz.to.gov.br/nfce/qrcode',
  },
  homologacao: {
    AC: 'http://hml.sefaznet.ac.gov.br/nfce/qrcode',
    AL: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp',
    AP: 'https://www.sefaz.ap.gov.br/nfce/nfcep.php',
    AM: 'https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
    BA: 'http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
    CE: 'http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html',
    DF: 'http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx',
    ES: 'http://homologacao.sefaz.es.gov.br/ConsultaNFCe',
    GO: 'https://homolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
    MA: 'http://homologacao.sefaz.ma.gov.br/portal/consultarNFCe.jsp',
    MT: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce',
    MS: 'http://www.dfe.ms.gov.br/nfce/qrcode',
    MG: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    PA: 'https://appnfc.sefa.pa.gov.br/portal-homologacao/view/consultas/nfce/nfceForm.seam',
    PB: 'http://www.sefaz.pb.gov.br/nfcehom',
    PR: 'http://www.fazenda.pr.gov.br/nfce/qrcode',
    PE: 'http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta',
    PI: 'http://www.sefaz.pi.gov.br/nfce/qrcode',
    RJ: 'https://homologacao.consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode',
    RN: 'https://hom.nfce.set.rn.gov.br/consultarNFCe.aspx',
    RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    RO: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp',
    RR: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode',
    SC: 'https://sat.sef.sc.gov.br/nfce/consulta',
    SP: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
    SE: 'http://www.hom.nfe.se.gov.br/nfce/consulta',
    TO: 'http://homologacao.sefaz.to.gov.br/nfce/qrcode',
  },
};
const NFE_TIMEZONE = 'America/Fortaleza';
const MUNICIPALITY_CODE_OVERRIDES: Record<string, string> = {
  'CE|FORTALEZA': '2304400',
};

type CertificateInfo = {
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  certificatePem: string;
  privateKeyPem: string;
  cnpj: string;
  validFrom: Date;
  validTo: Date;
};

function onlyDigits(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function firstXmlText(xml: string, tag: string): string {
  const pattern = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const value = xml.match(pattern)?.[1];
  return value ? decodeXml(value.replace(/<[^>]+>/g, '').trim()) : '';
}

function parseSefazResponse(xml: string) {
  const statuses = [...xml.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((match) => match[1]);
  const motives = [...xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map((match) => decodeXml(match[1]));
  const cStat = statuses[statuses.length - 1] || '999';
  return {
    success: ['100', '103', '104', '105', '107', '150', '135'].includes(cStat),
    authorized: ['100', '150'].includes(cStat),
    cStat,
    rawStatus: statuses.join(','),
    xMotivo: motives[motives.length - 1] || firstXmlText(xml, 'faultstring') || 'Resposta da Sefaz sem motivo',
    protocolo: firstXmlText(xml, 'nProt') || undefined,
    recibo: firstXmlText(xml, 'nRec') || undefined,
    xmlRetorno: xml,
  };
}

function getBagLocalKeyId(bag: any): string {
  const raw = Array.isArray(bag?.attributes?.localKeyId)
    ? bag.attributes.localKeyId[0]
    : bag?.attributes?.localKeyId;
  return raw ? forge.util.bytesToHex(String(raw)) : '';
}

function publicKeyMatchesPrivateKey(certificate: forge.pki.Certificate, privateKey: forge.pki.PrivateKey) {
  const certPublicKey = certificate.publicKey as any;
  const key = privateKey as any;
  return Boolean(certPublicKey?.n && certPublicKey?.e && key?.n && key?.e && certPublicKey.n.equals(key.n) && certPublicKey.e.equals(key.e));
}

function isCertificateAuthority(certificate: forge.pki.Certificate) {
  return (certificate.extensions || []).some((extension: any) =>
    String(extension.name || '').toLowerCase() === 'basicconstraints' && extension.cA === true
  );
}

function getSubjectValue(certificate: forge.pki.Certificate, names: string[]) {
  for (const attr of certificate.subject.attributes as any[]) {
    const key = String(attr.shortName || attr.name || '').toLowerCase();
    if (names.some((name) => key === name.toLowerCase())) return String(attr.value || '');
  }
  return '';
}

function loadPfxForSigning(base64Data: string, password: string): CertificateInfo {
  const p12Data = forge.util.decode64(base64Data);
  const p12Asn1 = forge.asn1.fromDer(p12Data);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  const privateKeyBag = keyBags.find((bag: any) => bag?.key);
  const privateKey = privateKeyBag?.key as forge.pki.PrivateKey | undefined;
  if (!privateKey) throw new Error('Nao consegui ler a chave privada do certificado A1. Confira a senha do certificado.');

  const privateKeyLocalId = getBagLocalKeyId(privateKeyBag);
  const certificateEntries = certBags
    .map((bag: any) => ({ certificate: bag?.cert as forge.pki.Certificate | undefined, localKeyId: getBagLocalKeyId(bag) }))
    .filter((entry: any) => entry.certificate);

  const certificate =
    certificateEntries.find((entry: any) =>
      (privateKeyLocalId && entry.localKeyId === privateKeyLocalId) ||
      publicKeyMatchesPrivateKey(entry.certificate, privateKey)
    )?.certificate ||
    certificateEntries.map((entry: any) => entry.certificate).find((item: forge.pki.Certificate) => !isCertificateAuthority(item)) ||
    certificateEntries[0]?.certificate;

  if (!certificate) throw new Error('Certificado nao encontrado no arquivo A1.');

  const cnValue = getSubjectValue(certificate, ['CN', 'commonName']);
  const cnpj = onlyDigits(cnValue).slice(-14);
  return {
    certificate,
    privateKey,
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    cnpj,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
  };
}

function validateCertificate(certInfo: CertificateInfo, expectedCnpj: string) {
  const errors: string[] = [];
  const now = new Date();
  if (certInfo.validFrom > now) errors.push('Certificado ainda nao esta valido.');
  if (certInfo.validTo < now) errors.push('Certificado vencido.');
  if (certInfo.cnpj && onlyDigits(expectedCnpj) && certInfo.cnpj !== onlyDigits(expectedCnpj)) {
    errors.push(`CNPJ do certificado (${certInfo.cnpj}) diferente do CNPJ fiscal (${onlyDigits(expectedCnpj)}).`);
  }
  if (!certInfo.cnpj) errors.push('Nao consegui identificar o CNPJ do certificado.');
  if (errors.length) throw new Error(`Certificado invalido: ${errors.join(' ')}`);
}

class XMLSigner {
  constructor(private certInfo: CertificateInfo) {}

  signXML(xmlContent: string): string {
    const sign = new SignedXml({
      privateKey: this.certInfo.privateKeyPem,
      publicCert: this.certInfo.certificatePem,
      idAttribute: 'Id',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    sign.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });

    sign.computeSignature(xmlContent, {
      location: {
        reference: "//*[local-name(.)='NFe']",
        action: 'append',
      },
    });

    return sign.getSignedXml();
  }
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
    hour12: false,
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

function getCodigoUFOrThrow(uf: string): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const code = CODIGO_UF[normalizedUf];
  if (!code) throw new Error(`UF fiscal invalida ou nao suportada: ${uf || 'vazia'}.`);
  return code;
}

function getAuthorizationEndpoint(uf: string, ambiente: Ambiente): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const envKey = `NFCE_${ambiente.toUpperCase()}_${normalizedUf}_AUTORIZACAO_URL`;
  const override = process.env[envKey];
  const endpoint = override || AUTH_ENDPOINTS[ambiente]?.[normalizedUf];
  if (!endpoint) {
    throw new Error(`Endpoint de autorizacao NFC-e nao configurado para ${normalizedUf}. Configure ${envKey}.`);
  }
  return endpoint.replace(/\?wsdl$/i, '');
}

function sanitizeCode(value: string): string {
  return String(value || '').replace(/[^\w.-]/g, '').slice(0, 60) || '000001';
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

function stripXmlDeclaration(xml: string): string {
  return String(xml || '').replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
}

function buildFiscalItems(orderItems: any[], settings: any, productFiscalById: Map<string, any> = new Map()) {
  return orderItems.map((item, index) => {
    const productFiscal = item.product_id ? productFiscalById.get(String(item.product_id)) || {} : {};
    const quantity = Math.max(Number(item.quantity || 1), 0.0001);
    const unitPrice = money(item.price || item.valor_unitario || 0);
    const total = money(item.subtotal ?? unitPrice * quantity);
    const ncm = String(item.ncm || item.fiscal_ncm || productFiscal.fiscal_ncm || settings.ncm_padrao || '21069090').replace(/\D/g, '').padStart(8, '0').slice(0, 8);
    return {
      product_id: item.product_id || null,
      codigo_produto: sanitizeCode(item.sku || item.codigo_produto || item.product_id || String(index + 1).padStart(6, '0')),
      descricao: String(item.product_name || item.name || item.descricao || `Item ${index + 1}`),
      ncm,
      cfop: String(item.cfop || item.fiscal_cfop || productFiscal.fiscal_cfop || settings.cfop_padrao || '5102'),
      unidade: String(item.unidade || 'UN'),
      quantidade: quantity,
      valor_unitario: unitPrice,
      valor_total: total,
      valor_desconto: money(item.discount || 0),
      origem: String(item.fiscal_origem || productFiscal.fiscal_origem || '0').replace(/\D/g, '').slice(0, 1) || '0',
      cest: String(item.fiscal_cest || productFiscal.fiscal_cest || '').replace(/\D/g, '').slice(0, 7) || null,
      cbenef: String(item.fiscal_beneficio || productFiscal.fiscal_beneficio || '').trim() || null,
      cst_icms: String(item.csosn || item.cst_icms || item.fiscal_csosn || productFiscal.fiscal_csosn || settings.csosn_padrao || '102'),
      aliquota_icms: Number(item.aliquota_icms || 0),
      valor_icms: Number(item.valor_icms || 0),
      cst_pis: String(item.cst_pis || item.fiscal_cst_pis || productFiscal.fiscal_cst_pis || settings.cst_pis_padrao || '07'),
      aliquota_pis: Number(item.aliquota_pis || 0),
      valor_pis: Number(item.valor_pis || 0),
      cst_cofins: String(item.cst_cofins || item.fiscal_cst_cofins || productFiscal.fiscal_cst_cofins || settings.cst_cofins_padrao || '07'),
      aliquota_cofins: Number(item.aliquota_cofins || 0),
      valor_cofins: Number(item.valor_cofins || 0),
    };
  });
}

function buildIcmsXml(item: any) {
  const csosn = String(item.cst_icms || '102').replace(/\D/g, '') || '102';
  const origem = String(item.origem || '0').replace(/\D/g, '').slice(0, 1) || '0';
  if (csosn === '500') {
    return `<ICMS><ICMSSN500><orig>${origem}</orig><CSOSN>500</CSOSN><vBCSTRet>0.00</vBCSTRet><pST>0.0000</pST><vICMSSubstituto>0.00</vICMSSubstituto><vICMSSTRet>0.00</vICMSSTRet></ICMSSN500></ICMS>`;
  }
  if (csosn === '900') {
    return `<ICMS><ICMSSN900><orig>${origem}</orig><CSOSN>900</CSOSN><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.0000</pICMS><vICMS>0.00</vICMS></ICMSSN900></ICMS>`;
  }
  return `<ICMS><ICMSSN102><orig>${origem}</orig><CSOSN>${csosn}</CSOSN></ICMSSN102></ICMS>`;
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

function normalizeFiscalPaymentMethod(method: string): string {
  const normalized = normalizeTextKey(String(method || '')).replace(/[^A-Z0-9]/g, '_');
  if (normalized.includes('PIX')) return normalized.includes('ONLINE') ? 'pix_online' : 'pix';
  if (normalized.includes('DEBITO') || normalized.includes('DEBIT')) return 'cartao_debito';
  if (normalized.includes('CREDITO') || normalized.includes('CREDIT')) return 'cartao_credito';
  if (normalized.includes('CARTAO') || normalized.includes('CARD')) return 'cartao_credito';
  if (normalized.includes('DINHEIRO') || normalized.includes('CASH')) return 'dinheiro';
  return String(method || '');
}

function mapPaymentMethod(method: string): string {
  const normalized = normalizeFiscalPaymentMethod(method);
  if (normalized.includes('pix')) return '17';
  if (normalized.includes('cartao_debito')) return '04';
  if (normalized.includes('cartao_credito')) return '03';
  if (normalized.includes('dinheiro')) return '01';
  return '99';
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

function buildPaymentCardXml(tPag: string, order: any): string {
  if (!['03', '04', '17'].includes(tPag)) return '';

  if (tPag === '17') {
    return '<card><tpIntegra>2</tpIntegra></card>';
  }

  const tef = order?.variations?.tef || {};
  const acquirerCnpj = onlyDigits(tef?.acquirer_cnpj || tef?.cnpj || '');
  const authorizationCode = String(tef?.auth || tef?.authorization_code || tef?.cAut || '').trim();
  const brandCode = mapCardBrand(tef?.brand);

  if (acquirerCnpj.length === 14 && authorizationCode) {
    return `<card><tpIntegra>1</tpIntegra><CNPJ>${acquirerCnpj}</CNPJ>${brandCode ? `<tBand>${brandCode}</tBand>` : ''}<cAut>${escapeXml(authorizationCode).slice(0, 128)}</cAut></card>`;
  }

  return '<card><tpIntegra>2</tpIntegra></card>';
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

function buildPaymentDetailsXml(order: any, paymentMethod: string, valorTotal: number): string {
  const lines = normalizeFiscalPaymentLines(order, paymentMethod, valorTotal);

  return lines.map((line) => {
    const tPag = mapPaymentMethod(line.method);
    const cardXml = buildPaymentCardXml(tPag, order);
    return `<detPag><indPag>0</indPag><tPag>${tPag}</tPag><vPag>${fixed2(line.amount)}</vPag>${cardXml}</detPag>`;
  }).join('');
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
  const { fiscalSettings, cupom, order, items, consumerData, observacoes, paymentMethod, deliveryFee, totalProdutos, valorDesconto, valorTotal, valorTributos } = input;
  const isHomologacao = fiscalSettings.ambiente !== 'producao';
  const dhEmi = formatNfeDate(new Date(cupom.data_hora_emissao));
  const codigoMunicipio = resolveMunicipalityCode(fiscalSettings);
  const consumidorDoc = onlyDigits(consumerData?.cpf_cnpj);
  const detXml = items.map((item, index) => {
    const productName = isHomologacao && index === 0
      ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : item.descricao;
    return `<det nItem="${index + 1}"><prod><cProd>${escapeXml(item.codigo_produto)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${escapeXml(productName)}</xProd><NCM>${item.ncm}</NCM>${item.cest ? `<CEST>${item.cest}</CEST>` : ''}<CFOP>${item.cfop}</CFOP><uCom>${escapeXml(item.unidade)}</uCom><qCom>${fixed4(item.quantidade)}</qCom><vUnCom>${fixed4(item.valor_unitario)}</vUnCom><vProd>${fixed2(item.valor_total)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${escapeXml(item.unidade)}</uTrib><qTrib>${fixed4(item.quantidade)}</qTrib><vUnTrib>${fixed4(item.valor_unitario)}</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>${fixed2(item.valor_total * 0.0765)}</vTotTrib>${buildIcmsXml(item)}${buildPisXml(item)}${buildCofinsXml(item)}</imposto></det>`;
  }).join('');
  const destXml = consumidorDoc
    ? `<dest>${consumidorDoc.length === 11 ? `<CPF>${consumidorDoc}</CPF>` : `<CNPJ>${consumidorDoc}</CNPJ>`}${consumerData?.nome ? `<xNome>${escapeXml(consumerData.nome)}</xNome>` : ''}<indIEDest>9</indIEDest></dest>`
    : '';
  const paymentXml = buildPaymentDetailsXml(order, paymentMethod, valorTotal);

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${cupom.chave_acesso}" versao="4.00"><ide><cUF>${getCodigoUFOrThrow(fiscalSettings.endereco_uf)}</cUF><cNF>${cupom.chave_acesso.substring(35, 43)}</cNF><natOp>Venda</natOp><mod>65</mod><serie>${Number(cupom.serie)}</serie><nNF>${cupom.numero}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>${codigoMunicipio}</cMunFG><tpImp>4</tpImp><tpEmis>1</tpEmis><cDV>${cupom.chave_acesso.slice(-1)}</cDV><tpAmb>${isHomologacao ? '2' : '1'}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>PopSystem-1.0</verProc></ide><emit><CNPJ>${onlyDigits(fiscalSettings.cnpj)}</CNPJ><xNome>${escapeXml(fiscalSettings.razao_social)}</xNome><xFant>${escapeXml(fiscalSettings.nome_fantasia || fiscalSettings.razao_social)}</xFant><enderEmit><xLgr>${escapeXml(fiscalSettings.endereco_logradouro)}</xLgr><nro>${escapeXml(fiscalSettings.endereco_numero)}</nro>${fiscalSettings.endereco_complemento ? `<xCpl>${escapeXml(fiscalSettings.endereco_complemento)}</xCpl>` : ''}<xBairro>${escapeXml(fiscalSettings.endereco_bairro)}</xBairro><cMun>${codigoMunicipio}</cMun><xMun>${escapeXml(fiscalSettings.endereco_municipio)}</xMun><UF>${escapeXml(fiscalSettings.endereco_uf)}</UF><CEP>${onlyDigits(fiscalSettings.endereco_cep)}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>${escapeXml(fiscalSettings.inscricao_estadual || 'ISENTO')}</IE><CRT>${Number(fiscalSettings.regime_tributario || 1)}</CRT></emit>${destXml}${detXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${fixed2(totalProdutos)}</vProd><vFrete>${fixed2(deliveryFee)}</vFrete><vSeg>0.00</vSeg><vDesc>${fixed2(valorDesconto)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${fixed2(valorTotal)}</vNF><vTotTrib>${fixed2(valorTributos)}</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag>${paymentXml}</pag>${observacoes ? `<infAdic><infCpl>${escapeXml(observacoes)}</infCpl></infAdic>` : ''}</infNFe></NFe>`;
}

function createAuthorizationEnvelope(signedNFe: string, uf: string) {
  const cUF = getCodigoUFOrThrow(uf);
  const loteId = Date.now().toString().slice(-15);
  const nfeXml = stripXmlDeclaration(signedNFe);
  const payload = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${loteId}</idLote><indSinc>1</indSinc>${nfeXml}</enviNFe>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${payload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function generateQRCodeData(
  chaveAcesso: string,
  uf: string,
  ambiente: Ambiente,
  dataEmissao: string,
  valorTotal: number,
  cpfCnpjConsumidor?: string,
  cscId?: string,
  cscToken?: string,
  digestValue?: string
): string {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cleanChaveAcesso = onlyDigits(chaveAcesso);

  if (!cscId || !cscToken) {
    throw new Error('CSC ID e CSC Token sao obrigatorios para gerar QR Code da NFC-e');
  }

  const cIdToken = normalizeCscId(cscId);
  const cleanCscToken = String(cscToken || '').trim();
  const fields = [cleanChaveAcesso, '2', tpAmb, cIdToken];
  const sha1 = forge.md.sha1.create();
  sha1.update(fields.join('|') + cleanCscToken, 'utf8');
  const hash = sha1.digest().toHex().toUpperCase();
  return `${getQRCodeBaseUrl(uf, ambiente)}?p=${[...fields, hash].join('|')}`;
}

function getQRCodeBaseUrl(uf: string, ambiente: Ambiente): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const envKey = `NFCE_${ambiente.toUpperCase()}_${normalizedUf}_QRCODE_URL`;
  const override = process.env[envKey];
  const endpoint = override || QR_CODE_URLS[ambiente]?.[normalizedUf];
  if (!endpoint) {
    throw new Error(`URL de QR Code NFC-e nao configurada para ${normalizedUf}. Configure ${envKey}.`);
  }
  return endpoint.replace(/[?&]+$/g, '');
}

function addNFCeSupplement(signedNFe: string, data: { qrCodeUrl: string; consultaUrl: string }): string {
  if (signedNFe.includes('<infNFeSupl>')) return signedNFe;
  const supplemental = `<infNFeSupl><qrCode>${escapeXml(data.qrCodeUrl)}</qrCode><urlChave>${escapeXml(data.consultaUrl)}</urlChave></infNFeSupl>`;
  if (signedNFe.includes('<Signature')) {
    return signedNFe.replace(/(<Signature\b)/, `${supplemental}$1`);
  }
  return signedNFe.replace('</NFe>', `${supplemental}</NFe>`);
}

function toHex(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex').toUpperCase();
}

function normalizeCscId(value?: string): string {
  const id = onlyDigits(value);
  if (!/^\d{1,6}$/.test(id)) {
    throw new Error('CSC ID invalido. Informe apenas o identificador numerico do CSC, normalmente 1 ou 2. O codigo grande da Sefaz deve ficar no campo CSC Token.');
  }
  return id;
}

function enrichQrCodeSchemaError(result: { cStat: string; xMotivo: string; [key: string]: any }, qrCodeUrl?: string, xml?: string) {
  const motivo = String(result.xMotivo || '');
  if (result.cStat !== '225' || !motivo.includes('infNFeSupl/qrCode') || !qrCodeUrl) return result;
  return { ...result, xMotivo: `${motivo}. Confira a URL do QR Code gerada para a NFC-e.` };
}

function extractQrAccessKey(qrCodeUrl: string): string {
  const param = String(qrCodeUrl || '').match(/[?&]p=([^&\s]+)/)?.[1] || '';
  return onlyDigits(decodeURIComponent(param).split('|')[0]).slice(0, 44);
}

function validateQrCodeMatchesAccessKey(qrCodeUrl: string, chaveAcesso: string) {
  const qrKey = extractQrAccessKey(qrCodeUrl);
  const xmlKey = onlyDigits(chaveAcesso).slice(0, 44);
  if (!qrKey || qrKey !== xmlKey) {
    throw new Error('QR Code NFC-e gerado com chave diferente da chave autorizada. Emissao bloqueada para evitar cupom fiscal inconsistente.');
  }
}

async function getNextNFCeNumber(supabase: any, userId: string, serie: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_next_nfce_number', { p_user_id: userId, p_serie: serie });
  if (error) throw new Error(`Erro ao gerar numero da NFC-e: ${error.message}`);
  return Number(data);
}

async function generateAccessKey(supabase: any, fiscalSettings: any, numero: number, dataEmissao: Date): Promise<string> {
  const parts = getNfeDateParts(dataEmissao);
  const aamm = `${parts.year.slice(-2)}${parts.month}`;
  const codigoNumerico = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const { data, error } = await supabase.rpc('generate_nfce_access_key', {
    p_uf: getCodigoUFOrThrow(fiscalSettings.endereco_uf),
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Metodo nao permitido.' });
  }

  let cupomId: string | null = null;
  let supabase: any = null;
  let lastXmlEnviado = '';

  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, error: 'Login nao confirmado para emitir NFC-e.' });

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ success: false, error: 'Nao consegui confirmar o usuario logado.' });
    const userId = userData.user.id;

    const { order_id, consumer_data, observacoes } = req.body || {};
    if (!order_id) return res.status(400).json({ success: false, error: 'Pedido obrigatorio para emitir NFC-e.' });

    const { data: fiscalSettings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!fiscalSettings) return res.status(400).json({ success: false, error: 'Configuracoes fiscais nao encontradas ou inativas.' });

    const uf = String(fiscalSettings.endereco_uf || '').toUpperCase();
    const ambiente: Ambiente = fiscalSettings.ambiente === 'producao' ? 'producao' : 'homologacao';
    const codigoUf = getCodigoUFOrThrow(uf);
    const codigoMunicipio = resolveMunicipalityCode(fiscalSettings);
    if (codigoMunicipio.length !== 7 || !codigoMunicipio.startsWith(codigoUf)) {
      return res.status(400).json({
        success: false,
        error: `Codigo do municipio fiscal invalido para ${uf}. Use o codigo IBGE com 7 digitos iniciando por ${codigoUf}.`,
      });
    }
    getQRCodeBaseUrl(uf, ambiente);
    const endpoint = getAuthorizationEndpoint(uf, ambiente);

    const certInfo = loadPfxForSigning(fiscalSettings.certificado_a1_base64, fiscalSettings.certificado_senha);
    validateCertificate(certInfo, fiscalSettings.cnpj);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ success: false, error: 'Pedido nao encontrado.' });

    const orderItems = normalizeOrderItems(order.items);
    if (!orderItems.length) return res.status(400).json({ success: false, error: 'Pedido sem itens para emissao fiscal.' });

    const productIds = Array.from(new Set(
      orderItems
        .map((item: any) => String(item?.product_id || '').trim())
        .filter(Boolean)
    ));
    const productFiscalById = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('id, fiscal_ncm, fiscal_cfop, fiscal_csosn, fiscal_cst_pis, fiscal_cst_cofins, fiscal_origem, fiscal_cest, fiscal_beneficio')
        .eq('user_id', userId)
        .in('id', productIds);
      if (productError) {
        const message = String(productError?.message || productError?.details || '');
        const code = String(productError?.code || '');
        if (code === 'PGRST204' || message.toLowerCase().includes('schema cache')) {
          console.warn('Campos fiscais de produtos ainda nao disponiveis no banco. Usando padroes fiscais.', productError);
        } else {
          throw new Error(`Erro ao buscar dados fiscais dos produtos: ${productError.message}`);
        }
      } else {
        for (const product of productRows || []) {
          productFiscalById.set(String(product.id), product);
        }
      }
    }

    const numeroNFCe = await getNextNFCeNumber(supabase, userId, fiscalSettings.nfce_serie);
    const dataEmissao = new Date();
    const chaveAcesso = await generateAccessKey(supabase, fiscalSettings, numeroNFCe, dataEmissao);
    const fiscalItems = buildFiscalItems(orderItems, fiscalSettings, productFiscalById);
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
        consumidor_nome: consumer_data?.nome || null,
        consumidor_cpf_cnpj: onlyDigits(consumer_data?.cpf_cnpj) || null,
        status: 'pendente',
        contingencia: false,
        data_hora_emissao: dataEmissao.toISOString(),
      }])
      .select()
      .single();
    if (cupomError) throw new Error(`Erro ao criar cupom: ${cupomError.message}`);
    cupomId = cupom.id;

    const items = fiscalItems.map((item) => ({ ...item, cupom_id: cupom.id }));
    const { error: itemsError } = await supabase.from('nfce_items').insert(items);
    if (itemsError) throw new Error(`Erro ao criar itens do cupom: ${itemsError.message}`);

    const xmlContent = generateNFCeXML({
      fiscalSettings,
      cupom,
      order,
      items,
      consumerData: consumer_data,
      observacoes,
      paymentMethod: order.payment_method,
      deliveryFee,
      totalProdutos,
      valorDesconto,
      valorTotal,
      valorTributos,
    });
    const signedNFe = new XMLSigner(certInfo).signXML(xmlContent);
    const digestValue = signedNFe.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1];
    const qrCodeUrl = generateQRCodeData(
      chaveAcesso,
      uf,
      ambiente,
      cupom.data_hora_emissao,
      valorTotal,
      consumer_data?.cpf_cnpj,
      fiscalSettings.csc_id,
      fiscalSettings.csc_token,
      digestValue
    );
    validateQrCodeMatchesAccessKey(qrCodeUrl, chaveAcesso);
    const finalNFe = addNFCeSupplement(signedNFe, {
      qrCodeUrl,
      consultaUrl: getQRCodeBaseUrl(uf, ambiente),
    });
    await supabase.from('nfce_cupons').update({
      xml_content: finalNFe,
      qr_code_url: qrCodeUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', cupom.id);
    const soapEnvelope = createAuthorizationEnvelope(finalNFe, uf);
    lastXmlEnviado = soapEnvelope;
    const xmlRetorno = await requestSefazSoap(
      endpoint,
      soapEnvelope,
      fiscalSettings.certificado_a1_base64,
      fiscalSettings.certificado_senha,
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote'
    );
    const parsed = enrichQrCodeSchemaError(parseSefazResponse(xmlRetorno), qrCodeUrl, finalNFe);
    const authorized = parsed.authorized;

    const updateData: any = {
      xml_autorizado: authorized ? xmlRetorno : null,
      status: authorized ? 'autorizado' : 'rejeitado',
      motivo_rejeicao: authorized ? null : `${parsed.cStat} - ${parsed.xMotivo}`,
      protocolo_autorizacao: authorized ? parsed.protocolo : null,
      data_hora_autorizacao: authorized ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    await supabase.from('nfce_cupons').update(updateData).eq('id', cupom.id);
    await supabase.from('nfce_transmissions').insert([{
      cupom_id: cupom.id,
      tipo_operacao: 'emissao',
      xml_enviado: soapEnvelope,
      xml_retorno: xmlRetorno,
      codigo_status: parsed.cStat,
      motivo: parsed.xMotivo,
      protocolo: parsed.protocolo,
      sucesso: authorized,
    }]);

    return res.status(200).json({
      success: authorized,
      cupom_id: cupom.id,
      numero: numeroNFCe,
      chave_acesso: chaveAcesso,
      serie: fiscalSettings.nfce_serie,
      qr_code_url: qrCodeUrl,
      xml_content: finalNFe,
      ambiente,
      status: updateData.status,
      protocolo: parsed.protocolo,
      motivo: parsed.xMotivo,
      cStat: parsed.cStat,
      runtime: 'vercel-node',
    });
  } catch (error: any) {
    const message = error?.message || 'Erro ao emitir NFC-e.';
    if (cupomId && supabase) {
      try {
        await supabase.from('nfce_cupons').update({
          status: 'rejeitado',
          motivo_rejeicao: `999 - ${message}`,
          updated_at: new Date().toISOString(),
        }).eq('id', cupomId);
        if (lastXmlEnviado) {
          await supabase.from('nfce_transmissions').insert([{
            cupom_id: cupomId,
            tipo_operacao: 'emissao',
            xml_enviado: lastXmlEnviado,
            xml_retorno: '',
            codigo_status: '999',
            motivo: message,
            sucesso: false,
          }]);
        }
      } catch {}
    }
    return res.status(500).json({ success: false, error: message, runtime: 'vercel-node' });
  }
}
