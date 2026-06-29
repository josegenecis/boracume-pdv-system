import forge from 'npm:node-forge@1.3.1';

const NFE_TIMEZONE = 'America/Fortaleza';

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
  const svrs = ambiente === 'producao'
    ? 'https://nfce.svrs.rs.gov.br/ws/NfeQRCode/NFeQRCode.asmx'
    : 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeQRCode/NFeQRCode.asmx';

  const urls: Record<string, string> = {
    CE: ambiente === 'producao'
      ? 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html'
      : 'http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html',
    SP: ambiente === 'producao'
      ? 'https://www.nfce.fazenda.sp.gov.br/qrcode'
      : 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
    PR: ambiente === 'producao'
      ? 'https://www.fazenda.pr.gov.br/nfce/qrcode'
      : 'https://www.fazenda.pr.gov.br/nfce/qrcode',
    AM: ambiente === 'producao'
      ? 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp'
      : 'https://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp',
  };

  return urls[normalizedUf] || svrs;
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
