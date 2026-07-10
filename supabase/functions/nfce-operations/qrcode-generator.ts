import forge from 'npm:node-forge@1.3.1';

const NFE_TIMEZONE = 'America/Fortaleza';
type AmbienteNFCe = 'producao' | 'homologacao';

const QR_CODE_URLS: Record<AmbienteNFCe, Record<string, string>> = {
  producao: {
    AC: 'http://www.sefaznet.ac.gov.br/nfce/qrcode',
    AL: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp',
    AP: 'https://www.sefaz.ap.gov.br/nfce/nfcep.php',
    AM: 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
    BA: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
    CE: 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html',
    DF: 'http://www.fazenda.df.gov.br/nfce/qrcode',
    ES: 'http://app.sefaz.es.gov.br/ConsultaNFCe/',
    GO: 'https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
    MA: 'https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp',
    MT: 'http://www.sefaz.mt.gov.br/nfce/consultanfce',
    MS: 'http://www.dfe.ms.gov.br/nfce/qrcode',
    MG: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    PA: 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam',
    PB: 'http://www.sefaz.pb.gov.br/nfce',
    PR: 'https://www.fazenda.pr.gov.br/nfce/qrcode',
    PE: 'http://nfce.sefaz.pe.gov.br/nfce/consulta',
    PI: 'http://www.sefaz.pi.gov.br/nfce/qrcode',
    RJ: 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode',
    RN: 'https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx',
    RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    RO: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp',
    RR: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode',
    SC: 'https://sat.sef.sc.gov.br/nfce/consulta',
    SP: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
    SE: 'http://www.nfce.se.gov.br/portal/portalNoticias.jsp',
    TO: 'http://www.sefaz.to.gov.br/nfce/qrcode',
  },
  homologacao: {
    AC: 'http://www.sefaznet.ac.gov.br/nfce/qrcode',
    AL: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp',
    AP: 'https://www.sefaz.ap.gov.br/nfce/nfcep.php',
    AM: 'https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
    BA: 'http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx',
    CE: 'http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html',
    DF: 'http://www.fazenda.df.gov.br/nfce/qrcode',
    ES: 'http://app.sefaz.es.gov.br/ConsultaNFCe/',
    GO: 'https://homolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe',
    MA: 'https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp',
    MT: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce',
    MS: 'http://www.dfe.ms.gov.br/nfce/qrcode',
    MG: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
    PA: 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam',
    PB: 'http://www.sefaz.pb.gov.br/nfce',
    PR: 'https://www.fazenda.pr.gov.br/nfce/qrcode',
    PE: 'http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta',
    PI: 'http://www.sefaz.pi.gov.br/nfce/qrcode',
    RJ: 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode',
    RN: 'https://nfce.set.rn.gov.br/consultarNFCe.aspx',
    RS: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx',
    RO: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp',
    RR: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode',
    SC: 'https://sat.sef.sc.gov.br/nfce/consulta',
    SP: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
    SE: 'http://www.nfce.se.gov.br/portal/portalNoticias.jsp',
    TO: 'http://www.sefaz.to.gov.br/nfce/qrcode',
  },
};

export function generateQRCodeData(
  chaveAcesso: string,
  uf: string,
  ambiente: 'producao' | 'homologacao',
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
  const p = [...fields, hash].join('|');

  return `${getQRCodeBaseUrl(uf, ambiente)}?p=${p}`;
}

export function getQRCodeBaseUrl(uf: string, ambiente: 'producao' | 'homologacao'): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const override = Deno.env.get(`NFCE_${ambiente.toUpperCase()}_${normalizedUf}_QRCODE_URL`)?.trim();
  const url = override || QR_CODE_URLS[ambiente]?.[normalizedUf];
  if (!url) {
    throw new Error(`URL do QR Code NFC-e nao configurada para ${normalizedUf}/${ambiente}. Configure NFCE_${ambiente.toUpperCase()}_${normalizedUf}_QRCODE_URL.`);
  }
  return normalizeQRCodeBaseUrl(url);
}

function onlyDigits(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

export function extractQrAccessKey(qrCodeUrl: string): string {
  const param = String(qrCodeUrl || '').match(/[?&]p=([^&\s]+)/)?.[1] || '';
  return onlyDigits(decodeURIComponent(param).split('|')[0]).slice(0, 44);
}

export function validateQRCodeMatchesAccessKey(qrCodeUrl: string, chaveAcesso: string) {
  const qrKey = extractQrAccessKey(qrCodeUrl);
  const xmlKey = onlyDigits(chaveAcesso).slice(0, 44);
  if (!qrKey || qrKey !== xmlKey) {
    throw new Error('QR Code NFC-e gerado com chave diferente da chave autorizada. Emissao bloqueada para evitar cupom fiscal inconsistente.');
  }
}

function normalizeCscId(value?: string): string {
  const id = onlyDigits(value);
  if (!/^\d{1,6}$/.test(id)) {
    throw new Error('CSC ID invalido. Informe apenas o identificador numerico do CSC, normalmente 1 ou 2. O codigo grande da Sefaz deve ficar no campo CSC Token.');
  }
  return id;
}

function normalizeQRCodeBaseUrl(value: string): string {
  let url = String(value || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/[?&]+$/g, '');
}

function toHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
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
