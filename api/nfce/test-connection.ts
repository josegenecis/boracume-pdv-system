import https from 'node:https';
import forge from 'node-forge';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://auth.popsystem.com.br';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

type Ambiente = 'producao' | 'homologacao';

const STATUS_ENDPOINTS: Record<Ambiente, Record<string, string>> = {
  producao: {
    SVRS: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    CE: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RS: 'https://nfce.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    SP: 'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    PR: 'https://nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
    AM: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico2',
  },
  homologacao: {
    SVRS: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    CE: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RS: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    SP: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    PR: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
    AM: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico2',
  },
};

const CODIGO_UF: Record<string, string> = {
  AC: '12',
  AL: '27',
  AP: '16',
  AM: '13',
  BA: '29',
  CE: '23',
  DF: '53',
  ES: '32',
  GO: '52',
  MA: '21',
  MT: '51',
  MS: '50',
  MG: '31',
  PA: '15',
  PB: '25',
  PR: '41',
  PE: '26',
  PI: '22',
  RJ: '33',
  RN: '24',
  RS: '43',
  RO: '11',
  RR: '14',
  SC: '42',
  SP: '35',
  SE: '28',
  TO: '17',
};

const ICP_BRASIL_ROOT_V10_CA = `-----BEGIN CERTIFICATE-----
MIIGrDCCBJSgAwIBAgIJANLVi0S/gZNCMA0GCSqGSIb3DQEBDQUAMIGYMQswCQYD
VQQGEwJCUjETMBEGA1UECgwKSUNQLUJyYXNpbDE9MDsGA1UECww0SW5zdGl0dXRv
IE5hY2lvbmFsIGRlIFRlY25vbG9naWEgZGEgSW5mb3JtYWNhbyAtIElUSTE1MDMG
A1UEAwwsQXV0b3JpZGFkZSBDZXJ0aWZpY2Fkb3JhIFJhaXogQnJhc2lsZWlyYSB2
MTAwHhcNMTkwNzAxMTkxNTU5WhcNMzIwNzAxMTIwMDU5WjCBmDELMAkGA1UEBhMC
QlIxEzARBgNVBAoMCklDUC1CcmFzaWwxPTA7BgNVBAsMNEluc3RpdHV0byBOYWNp
b25hbCBkZSBUZWNub2xvZ2lhIGRhIEluZm9ybWFjYW8gLSBJVEkxNTAzBgNVBAMM
LEF1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjEwMIIC
IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAk3AxKl1ZtP0pNyjChqO7qNkn
+/sClZeqiV/Kd7KnnbkDbI2y3VWcUG7feCE/deIxot6GH6JXncRG794UZl+4doD0
D0/cEwBd4DvrDSZm0RT40xhmYYOTxZDJxv+coTHdmsT5aNmSkktfjzYX4HQHh/7M
em+kTOpT/3E4K6B7KVs9HkOT7nXx5yU1qYbVWqI0qpJM9mOTSFx8C9HiKcHvLCvt
1ioXKPAmFuHPkayOcXP2MXeb+VRNjWKU4E+L2t5uZPKVx1M/9i1DztlLb4K8OfYg
GaPDUSF1sxnoGk5qZHLleO6KjCpmuQepmgsBvxi2YNO7X2YUwQQx1AXNSolgtkAR
5gt+1WzxhbFUhItQqlhqxgWHefLmiT5T/Ctz/P2v+zSO4efkkIzsi1iwD+ypZvM2
lnIvB24RcSN6jzmCahLPX4CwjwIK6JsSoMVxIhpZHCguUP4LXqP8IWUZ6WgS/4zB
7B9E0EICl2rM1PRy+6ulv+ZOW256e8a0pijUB+hXM1msUq9L92476FAAX8va3sP7
+Uut94+bGHmubcTLImWUPrxNT7QyrvE3FyHicfiHioeFL2oV4cXTLZrEq2wS8R4P
KPdSzNn5Z9e2uMEGYQaSNO+OwvVycpIhOBOqrm12wJ9ZhWKtM5UOo34/o37r5ZBI
TYXAGbhqQDB9mWXwH+0CAwEAAaOB9jCB8zBOBgNVHSAERzBFMEMGBWBMAQEAMDow
OAYIKwYBBQUHAgEWLGh0dHA6Ly9hY3JhaXouaWNwYnJhc2lsLmdvdi5ici9EUENh
Y3JhaXoucGRmMEAGA1UdHwQ5MDcwNaAzoDGGL2h0dHA6Ly9hY3JhaXouaWNwYnJh
c2lsLmdvdi5ici9MQ1JhY3JhaXp2MTAuY3JsMB8GA1UdIwQYMBaAFHTzfv/8n1N6
8Xzrqz6kptoYukVjMB0GA1UdDgQWBBR0837//J9TevF866s+pKbaGLpFYzAPBgNV
HRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQ0FAAOCAgEA
eCNhBSuy/Ih/T+1VOtAJju85SrtoE3vET1qXASpmjQllDHG/ph7VFNRAkC+gha+B
CbjoA5oJ/8wwl+Qdp1KGz6nXXFTLx3osU+kjm0srmBf9nyXHPqvFyvBeB0A7sYb7
TmII9GKD20oCxsdkccR/oE/JuTaNnGq0GYZ2aDb5v62uLi21Y6P9UBiTxZqQ4ojW
ET6kXNjlK238jpXv17FR8Sg3VusCvX7Q8eJkavvHHZDeWck2fSA+ycAc2JeL2Z0B
MSxGWpH32WM9J8+6XqCJUXHiWEV0zCE8wDYiYC+047pTxQI/gB/FcU7jvylh98DJ
kQPHd/Tp6Og3ynlDA9n9uBbxYHVRZs9vsZ/7xTFaxRe+zk8dhgKgZ/3RrcMFB570
2t8LFbyuUE/kQVY6rZ0QJ9qMWQ7VPLRwRhiMeU3k8WDJb/tBbOXHBqldTbWyQ+mp
MEDWhbrzE/IED82wAuO23Tb05cYk2xC7+Izef8fSc3XdJDuPSbcDpWukzyCDtSEH
isLiGEtIbYRiPsF3czlQPsnIEVoTTCWxHCH1zYR6zScSv18Qh69qVe2J40K5jZoP
GEOhq/oKhVJQAdvAFW5Odp7mF3Tk9nivjjsctJSxY26LFiV5GRV+07SSse4ti0aO
jO5PLg5SWjfcOtBG2rz02EIvQAmLcb0kGBtfdj0lW/w=
-----END CERTIFICATE-----`;

const AC_SAFEWEB_RFB_V5_CA = `-----BEGIN CERTIFICATE-----
MIIG2TCCBMGgAwIBAgIBFDANBgkqhkiG9w0BAQ0FADCBkDELMAkGA1UEBhMCQlIx
EzARBgNVBAoMCklDUC1CcmFzaWwxNDAyBgNVBAsMK0F1dG9yaWRhZGUgQ2VydGlm
aWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEgdjUxNjA0BgNVBAMMLUFDIFNlY3JldGFy
aWEgZGEgUmVjZWl0YSBGZWRlcmFsIGRvIEJyYXNpbCB2NDAeFw0xODAxMzExNzEy
MjZaFw0yOTAyMjAxNzEyMjZaMHYxCzAJBgNVBAYTAkJSMRMwEQYDVQQKEwpJQ1At
QnJhc2lsMTYwNAYDVQQLEy1TZWNyZXRhcmlhIGRhIFJlY2VpdGEgRmVkZXJhbCBk
byBCcmFzaWwgLSBSRkIxGjAYBgNVBAMTEUFDIFNBRkVXRUIgUkZCIHY1MIICIjAN
BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAmjjzy8+APTin3kQJtD0/MxLtTC4U
Wqhv753mI6ha0g/YLqUkrirkzy8AiZFTBFPNmoETg7PRHZMpX9egg2xnQFGXFbKI
IVwNvQ1fRkcHwY3myTZ2FOCVUs22D7SOUlS5frJ/C1Z4w9B2LQov6tlkfliu4NSh
Gt+/yo6kCL1I+ClDWd5i3o6BJeP3EnZmzZG6PhQA7/cMFkDt8M5H4ll2L7QzYzec
dOdMDnwNYEs0sPuxow/3Fs2qNg2kUI3iVqBzVmPo4svxrvFRRse8GzZZGn0ew5F8
F2Qi4Khzpq+hjY60mPSiGDJgIlqmL1S6dUapPsijzcjjha9GSoDcxAXs0NxJ0pxn
9QyT+vsT37QH5QrYzkLY4IrUKdugS+ovsV/1qw8bmoYAOTS3j2F6xSj3hB4Oi06J
jGnnmbZ2PN8sK/IB83O4kpclJ6zPXROYpfAnLVPkZPz+YKVDJYDoeObfvV1EydzP
aS5lI0h1NTRbkU9mhB+bjKSMy5crY/sQDnc8+xVknRsBYf+4Ux+CPMWXzq5C+93a
8B9qPijdGuwE4Uuk8+UB7rKRamBbR/8rBlFVg8IxYgJO3h1ie2ggEAhttCdSBLJw
/DY+52o4RaEkRYfS6UOoFav36wARBHi1q1rLfEPs7ChhIU++c3hQ5R6mNOIBQ/lw
Ds8IKxsNTM++218CAwEAAaOCAVUwggFRMIGnBgNVHSAEgZ8wgZwwTAYGYEwBAgEz
MEIwQAYIKwYBBQUHAgEWNGh0dHA6Ly93d3cucmVjZWl0YS5mYXplbmRhLmdvdi5i
ci9hY3JmYi9kcGNhY3JmYi5wZGYwTAYGYEwBAgMwMEIwQAYIKwYBBQUHAgEWNGh0
dHA6Ly93d3cucmVjZWl0YS5mYXplbmRhLmdvdi5ici9hY3JmYi9kcGNhY3JmYi5w
ZGYwRAYDVR0fBD0wOzA5oDegNYYzaHR0cDovL3d3dy5yZWNlaXRhLmZhemVuZGEu
Z292LmJyL2FjcmZiL2FjcmZidjQuY3JsMB8GA1UdIwQYMBaAFBqY5kPKHN2Snplj
RVoq6R+HIM01MB0GA1UdDgQWBBQpXkvVRky7/hanY8EdxCby3djzBTAPBgNVHRMB
Af8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQ0FAAOCAgEAGWC5
rgd5HgB7JalALQjschl/067u14PAKrZuGJFJN0vSBJAeZNZgalmsJJz+IlxrNYQW
UXKm3l8NLw9ar2wHKDPD8DIPC7rFeyb15ETI2LJR2VqT5vHsG/aZXcv6Vmm7lFOn
0aFGfBXNX0ZjzbtOianhcBoHAydmSZv4k91kpJ+kprbGCcI561UliVTjxxk3VNtp
cKxEcextm0UUQEiF8po+qmtE+K/y7RN7YzY/S6NBfEJYoqLjqQST3xyb7mtxks/j
IyWnvzh7WW4Nk1s3L7H3+3AbF1WREzmFUOyx7y6cgJudvdF96YSHu5ds3qrJv5qI
s0L1vZTyLjNl6MP3WSxs1O9FQffNFafogL7IU/4BjOKt7XVkrempqgWvVdjUKYr7
gwxTrT0d2qKgpXASgxRdKPOJ0aca70PrZycZrVwENTnpzh0heXop/BMgrrHNUxJ9
1lnQkJPeNOxzHpcwCPNuWZ4eGR9df8aFrGViaUb50pMQa4zpH5v9dIYjuMkDlsfv
oV/92OX5L3Zo2Se0n4RjJ1oF99NQcD7SZWNNUHUKeuhQ1I+ld2RDqP7GWxH1tlWk
YT9Eo3cFNlEU8Ou48irj43lU99FxM7E7CLIhoX8PrbY1oGJYJ+v3Vysqb/uXLz84
SkhvHH1eW0mwsTd62oYNClLDg+PQllrysLTu5Kg=
-----END CERTIFICATE-----`;

function onlyDigits(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseStatusResponse(xml: string) {
  const statuses = [...xml.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((match) => match[1]);
  const motives = [...xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map((match) => decodeXml(match[1]));
  const fault = firstXmlText(xml, 'faultstring') || firstXmlText(xml, 'Reason') || firstXmlText(xml, 'Text');
  const cStat = statuses[statuses.length - 1] || '999';
  const motivo = motives[motives.length - 1] || fault || 'Resposta da Sefaz sem motivo';
  return {
    success: ['100', '103', '104', '105', '107', '150', '135'].includes(cStat),
    cStat,
    motivo,
    rawStatus: statuses.join(','),
  };
}

function firstXmlText(xml: string, tag: string): string {
  const pattern = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const value = xml.match(pattern)?.[1];
  return value ? decodeXml(value.replace(/<[^>]+>/g, '').trim()) : '';
}

function createStatusEnvelope(uf: string, ambiente: Ambiente) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const cUF = CODIGO_UF[uf] || CODIGO_UF.CE;
  const payload = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">${payload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
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

function getAttributeValue(certificate: forge.pki.Certificate, names: string[]) {
  for (const attr of certificate.subject.attributes as any[]) {
    const key = String(attr.shortName || attr.name || '').toLowerCase();
    if (names.some((name) => key === name.toLowerCase())) return String(attr.value || '');
  }
  return '';
}

function isCertificateAuthority(certificate: forge.pki.Certificate) {
  return (certificate.extensions || []).some((extension: any) =>
    String(extension.name || '').toLowerCase() === 'basicconstraints' && extension.cA === true
  );
}

function loadPfxAsPem(base64Data: string, password: string) {
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

  const linkedCertificate = certificateEntries.find((entry: any) =>
    (privateKeyLocalId && entry.localKeyId === privateKeyLocalId) ||
    publicKeyMatchesPrivateKey(entry.certificate, privateKey)
  )?.certificate;

  const certificate =
    linkedCertificate ||
    certificateEntries.map((entry: any) => entry.certificate).find((item: forge.pki.Certificate) => !isCertificateAuthority(item)) ||
    certificateEntries[0]?.certificate;

  if (!certificate) throw new Error('Certificado nao encontrado no arquivo A1.');

  let certPem = forge.pki.certificateToPem(certificate);
  const issuer = getAttributeValue(certificate, ['CN', 'commonName']).toUpperCase();
  const issuerText = certificate.issuer.attributes.map((attr: any) => String(attr.value || '')).join(' ').toUpperCase();
  if ((issuer.includes('SAFEWEB') || issuerText.includes('AC SAFEWEB RFB V5')) && !certPem.includes('AC SAFEWEB RFB v5')) {
    certPem += AC_SAFEWEB_RFB_V5_CA;
  }

  return {
    cert: certPem,
    key: forge.pki.privateKeyToPem(privateKey),
  };
}

export function requestSefazSoap(
  endpoint: string,
  soapEnvelope: string,
  pfxBase64: string,
  passphrase: string,
  soapAction: string
): Promise<string> {
  const body = Buffer.from(soapEnvelope, 'utf8');
  const url = new URL(endpoint);
  const credentials = loadPfxAsPem(pfxBase64, passphrase);
  const agent = new https.Agent({
    cert: credentials.cert,
    key: credentials.key,
    ca: ICP_BRASIL_ROOT_V10_CA,
    keepAlive: false,
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        agent,
        timeout: 30000,
	        headers: {
	          'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
	          SOAPAction: `"${soapAction}"`,
	          Accept: 'application/soap+xml, text/xml, */*',
	          'Content-Length': String(body.length),
	          Connection: 'close',
        },
      },
	      (response) => {
	        const chunks: Buffer[] = [];
	        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
	        response.on('end', () => {
	      const xml = Buffer.concat(chunks).toString('utf8');
	      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
	            const parsed = parseStatusResponse(xml);
	            const rawMessage = xml
	              .replace(/\s+/g, ' ')
	              .trim()
	              .slice(0, 700);
	            const parsedMessage = parsed.motivo && parsed.motivo !== 'Resposta da Sefaz sem motivo' ? parsed.motivo : '';
	            reject(new Error(`Sefaz respondeu HTTP ${response.statusCode}: ${parsedMessage || rawMessage || response.statusMessage || 'sem detalhe'}`.trim()));
	            return;
	          }
	          resolve(xml);
	        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Tempo esgotado ao comunicar com a Sefaz.'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function requestSefazStatus(endpoint: string, soapEnvelope: string, pfxBase64: string, passphrase: string): Promise<string> {
  return requestSefazSoap(
    endpoint,
    soapEnvelope,
    pfxBase64,
    passphrase,
    'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF'
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, motivo: 'Metodo nao permitido.' });
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return res.status(401).json({ success: false, motivo: 'Login nao confirmado para testar a Sefaz.' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({ success: false, motivo: 'Nao consegui confirmar o usuario logado.' });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('ativo', true)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings) {
      return res.status(400).json({ success: false, motivo: 'Salve as configuracoes fiscais antes de testar.' });
    }

    const uf = String(settings.endereco_uf || '').toUpperCase();
    const ambiente: Ambiente = settings.ambiente === 'producao' ? 'producao' : 'homologacao';
    const codigoMunicipio = onlyDigits(settings.codigo_municipio);

    if (uf === 'CE' && (codigoMunicipio.length !== 7 || !codigoMunicipio.startsWith('23'))) {
      return res.status(400).json({
        success: false,
        motivo: 'Codigo do municipio do Ceara deve ser o codigo IBGE com 7 digitos. Fortaleza, por exemplo, e 2304400.',
      });
    }

    if (!settings.certificado_a1_base64 || !settings.certificado_senha) {
      return res.status(400).json({ success: false, motivo: 'Certificado A1 e senha sao obrigatorios.' });
    }

    const endpoint = STATUS_ENDPOINTS[ambiente][uf] || STATUS_ENDPOINTS[ambiente].SVRS;
    const xml = await requestSefazStatus(
      endpoint,
      createStatusEnvelope(uf, ambiente),
      settings.certificado_a1_base64,
      settings.certificado_senha
    );
    const parsed = parseStatusResponse(xml);

    return res.status(200).json({
      ...parsed,
      uf,
      ambiente,
      endpoint,
      runtime: 'vercel-node',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      motivo: error?.message || 'Erro ao testar conexao com a Sefaz.',
      runtime: 'vercel-node',
    });
  }
}
