import {
  Ambiente,
  getSefazEndpoint,
  getSoapNamespace,
  parseSefazResponse,
  SefazResponse,
} from './sefaz-endpoints.ts';
import { XMLSigner } from './xml-signer.ts';
import { CertificateInfo } from './certificate-utils.ts';

export class SefazClient {
  private xmlSigner: XMLSigner;
  private httpClient?: Deno.HttpClient;

  constructor(private certInfo: CertificateInfo) {
    this.xmlSigner = new XMLSigner(certInfo);
    this.httpClient = Deno.createHttpClient({
      cert: certInfo.certificatePem,
      key: certInfo.privateKeyPem,
    });
  }

  close() {
    this.httpClient?.close();
  }

  async enviarNFCe(xmlNFCe: string, uf: string, ambiente: Ambiente): Promise<SefazResponse> {
    const signedNFe = this.xmlSigner.signXML(xmlNFCe);
    const loteId = Date.now().toString().slice(-15);
    const payload = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${loteId}</idLote><indSinc>1</indSinc>${signedNFe}</enviNFe>`;
    const result = await this.callSefaz('autorizacao', payload, uf, ambiente, 'nfeAutorizacaoLote');
    return {
      ...result,
      xmlEnviado: signedNFe,
      digestValue: signedNFe.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1],
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
    const soapEnvelope = this.createSoapEnvelope(payload, namespace, soapAction);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        body: soapEnvelope,
        client: this.httpClient,
      } as RequestInit & { client?: Deno.HttpClient });

      const xmlResponse = await response.text();
      if (!response.ok) {
        return {
          success: false,
          cStat: String(response.status),
          xMotivo: `Erro HTTP ${response.status}: ${response.statusText}`,
          xmlRetorno: xmlResponse,
        };
      }

      return parseSefazResponse(xmlResponse);
    } catch (error) {
      return {
        success: false,
        cStat: '999',
        xMotivo: `Erro de comunicacao com a Sefaz: ${error.message}`,
        xmlRetorno: '',
      };
    }
  }

  private createSoapEnvelope(payload: string, namespace: string, operation: string): string {
    return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><${operation} xmlns="${namespace}"><nfeDadosMsg>${payload}</nfeDadosMsg></${operation}></soap12:Body></soap12:Envelope>`;
  }
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
  return codigos[String(uf || '').toUpperCase()] || '35';
}
