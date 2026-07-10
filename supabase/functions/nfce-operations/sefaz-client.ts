import {
  Ambiente,
  getSefazEndpoint,
  getSoapNamespace,
  parseSefazResponse,
  SefazResponse,
} from './sefaz-endpoints.ts';
import { XMLSigner } from './xml-signer.ts';
import { CertificateInfo } from './certificate-utils.ts';
import { generateQRCodeData, getQRCodeBaseUrl, validateQRCodeMatchesAccessKey } from './qrcode-generator.ts';

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

// Official ICP-Brasil intermediate for certificates issued by AC SAFEWEB RFB v5.
// Some A1 files contain only the leaf certificate, but SVRS may reject the mTLS
// handshake unless the client sends the issuing intermediate too.
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

export class SefazClient {
  private xmlSigner: XMLSigner;
  private httpClient?: Deno.HttpClient;

  constructor(private certInfo: CertificateInfo) {
    this.xmlSigner = new XMLSigner(certInfo);
    this.httpClient = Deno.createHttpClient({
      cert: buildClientCertificateChain(certInfo),
      key: certInfo.privateKeyPem,
      caCerts: [ICP_BRASIL_ROOT_V10_CA],
      http1: true,
      http2: false,
    });
  }

  close() {
    this.httpClient?.close();
  }

  async enviarNFCe(
    xmlNFCe: string,
    uf: string,
    ambiente: Ambiente,
    qrCode?: {
      chaveAcesso: string;
      dataEmissao: string;
      valorTotal: number;
      cpfCnpjConsumidor?: string;
      cscId?: string;
      cscToken?: string;
    }
  ): Promise<SefazResponse> {
    const signedNFe = this.xmlSigner.signXML(xmlNFCe);
    const digestValue = signedNFe.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1];
    const generatedQrCodeUrl = qrCode ? generateQRCodeData(
      qrCode.chaveAcesso,
      uf,
      ambiente,
      qrCode.dataEmissao,
      qrCode.valorTotal,
      qrCode.cpfCnpjConsumidor,
      qrCode.cscId,
      qrCode.cscToken,
      digestValue
    ) : undefined;
    if (qrCode && generatedQrCodeUrl) {
      validateQRCodeMatchesAccessKey(generatedQrCodeUrl, qrCode.chaveAcesso);
    }
    const finalNFe = qrCode && generatedQrCodeUrl
      ? addNFCeSupplement(signedNFe, {
          qrCodeUrl: generatedQrCodeUrl,
          consultaUrl: getQRCodeBaseUrl(uf, ambiente),
        })
      : signedNFe;
    const loteId = Date.now().toString().slice(-15);
    const nfeXml = stripXmlDeclaration(finalNFe);
    const payload = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${loteId}</idLote><indSinc>1</indSinc>${nfeXml}</enviNFe>`;
    const result = await this.callSefaz('autorizacao', payload, uf, ambiente, 'nfeAutorizacaoLote');
    const enrichedResult = enrichQrCodeSchemaError(result, generatedQrCodeUrl, finalNFe);
    return {
      ...enrichedResult,
      xmlEnviado: finalNFe,
      digestValue,
      qrCodeUrl: generatedQrCodeUrl,
    };
  }

  async consultarRecibo(recibo: string, uf: string, ambiente: Ambiente): Promise<SefazResponse> {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const payload = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><nRec>${recibo}</nRec></consReciNFe>`;
    return await this.callSefaz('retAutorizacao', payload, uf, ambiente, 'nfeRetAutorizacaoLote');
  }

  async consultarNFCe(chaveAcesso: string, uf: string, ambiente: Ambiente): Promise<SefazResponse> {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const payload = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chaveAcesso}</chNFe></consSitNFe>`;
    return await this.callSefaz('consulta', payload, uf, ambiente, 'nfeConsultaNF');
  }

  async consultarStatusServico(uf: string, ambiente: Ambiente): Promise<SefazResponse> {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const cUF = getCodigoUF(uf);
    const payload = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
    return await this.callSefaz('status', payload, uf, ambiente, 'nfeStatusServicoNF');
  }

  async cancelarNFCe(
    chaveAcesso: string,
    protocolo: string,
    motivo: string,
    uf: string,
    ambiente: Ambiente,
    cnpj: string
  ): Promise<SefazResponse> {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const timestamp = formatNfeDate(new Date());
    const sequence = '1';
    const eventId = `ID110111${chaveAcesso}${sequence.padStart(2, '0')}`;
    const eventXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${eventId}"><cOrgao>${getCodigoUF(uf)}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${onlyDigits(cnpj)}</CNPJ><chNFe>${chaveAcesso}</chNFe><dhEvento>${timestamp}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${sequence}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${protocolo}</nProt><xJust>${escapeXml(motivo).slice(0, 255)}</xJust></detEvento></infEvento></evento>`;
    const signedEvent = this.xmlSigner.signXML(eventXml);
    const payload = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote>${signedEvent}</envEvento>`;
    return await this.callSefaz('evento', payload, uf, ambiente, 'nfeRecepcaoEvento');
  }

  private async callSefaz(
    operation: 'autorizacao' | 'retAutorizacao' | 'consulta' | 'status' | 'evento',
    payload: string,
    uf: string,
    ambiente: Ambiente,
    soapAction: string
  ): Promise<SefazResponse> {
    const endpoint = getSefazEndpoint(uf, ambiente, operation);
    const namespace = getSoapNamespace(operation);
    const action = `${namespace}/${soapAction}`;
    const soapEnvelope = this.createSoapEnvelope(payload, namespace, uf);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`,
          SOAPAction: `"${action}"`,
          Accept: 'application/soap+xml, text/xml, */*',
        },
        body: soapEnvelope,
        client: this.httpClient,
      } as RequestInit & { client?: Deno.HttpClient });

      const xmlResponse = await response.text();
      if (!response.ok) {
        const rawMessage = xmlResponse.replace(/\s+/g, ' ').trim().slice(0, 700);
        return {
          success: false,
          cStat: String(response.status),
          xMotivo: `Sefaz respondeu HTTP ${response.status}: ${rawMessage || response.statusText || 'sem detalhe'}`,
          xmlRetorno: xmlResponse,
        };
      }

      return parseSefazResponse(xmlResponse);
    } catch (error) {
      return {
        success: false,
        cStat: '999',
        xMotivo: `Erro de comunicacao com a Sefaz (${endpoint}): ${getErrorMessage(error)}`,
        xmlRetorno: '',
      };
    }
  }

  private createSoapEnvelope(payload: string, namespace: string, uf: string): string {
    return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${namespace}"><cUF>${getCodigoUF(uf)}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${namespace}">${payload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }
}

function buildClientCertificateChain(certInfo: CertificateInfo): string {
  let chain = certInfo.certificateChainPem || certInfo.certificatePem;
  const issuer = String(certInfo.issuer || '').toUpperCase();
  const hasSafeweb = chain.includes('AC SAFEWEB RFB v5') || chain.includes(AC_SAFEWEB_RFB_V5_CA.trim());
  if (issuer.includes('AC SAFEWEB RFB V5') && !hasSafeweb) {
    chain += AC_SAFEWEB_RFB_V5_CA;
  }
  return chain;
}

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function addNFCeSupplement(signedNFe: string, data: { qrCodeUrl: string; consultaUrl: string }): string {
  if (signedNFe.includes('<infNFeSupl>')) return signedNFe;
  const supplemental = `<infNFeSupl><qrCode>${escapeXml(data.qrCodeUrl)}</qrCode><urlChave>${escapeXml(data.consultaUrl)}</urlChave></infNFeSupl>`;
  if (signedNFe.includes('<Signature')) {
    return signedNFe.replace(/(<Signature\b)/, `${supplemental}$1`);
  }
  return signedNFe.replace('</NFe>', `${supplemental}</NFe>`);
}

function enrichQrCodeSchemaError(result: SefazResponse, qrCodeUrl?: string, xml?: string): SefazResponse {
  const motivo = String(result.xMotivo || '');
  if (result.cStat !== '225' || !motivo.includes('infNFeSupl/qrCode') || !qrCodeUrl) {
    return result;
  }
  return {
    ...result,
    xMotivo: `${motivo}. Confira a URL do QR Code gerada para a NFC-e.`,
  };
}

function stripXmlDeclaration(xml: string): string {
  return String(xml || '').replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
}

function formatNfeDate(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return date.toISOString().replace(/\.\d{3}Z$/, offset);
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}
