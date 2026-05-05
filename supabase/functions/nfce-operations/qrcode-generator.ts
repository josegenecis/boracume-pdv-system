import forge from 'npm:node-forge@1.3.1';

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
  if (!cscId || !cscToken) {
    throw new Error('CSC ID e CSC Token sao obrigatorios para gerar QR Code da NFC-e');
  }

  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const dhEmiHex = toHex(formatNfeDate(new Date(dataEmissao)));
  const vNF = Number(valorTotal || 0).toFixed(2);
  const vICMS = '0.00';
  const digValHex = toHex(digestValue || '');
  const cDest = onlyDigits(cpfCnpjConsumidor);

  const fields = [
    chaveAcesso,
    '2',
    tpAmb,
    cDest,
    dhEmiHex,
    vNF,
    vICMS,
    digValHex,
    cscId,
  ];
  const sha1 = forge.md.sha1.create();
  sha1.update(fields.join('|') + cscToken, 'utf8');
  const hash = sha1.digest().toHex().toUpperCase();
  const p = [...fields, hash].join('|');

  return `${getQRCodeBaseUrl(uf, ambiente)}?p=${encodeURIComponent(p)}`;
}

function getQRCodeBaseUrl(uf: string, ambiente: 'producao' | 'homologacao'): string {
  const normalizedUf = String(uf || '').toUpperCase();
  const svrs = ambiente === 'producao'
    ? 'https://nfce.svrs.rs.gov.br/ws/NfeQRCode/NFeQRCode.asmx'
    : 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeQRCode/NFeQRCode.asmx';

  const urls: Record<string, string> = {
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

function toHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function formatNfeDate(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return date.toISOString().replace(/\.\d{3}Z$/, offset);
}
