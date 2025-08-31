
import { getSefazEndpoint, parseSefazResponse, SefazResponse } from './sefaz-endpoints.ts';
import { XMLSigner } from './xml-signer.ts';
import { CertificateInfo } from './certificate-utils.ts';

export class SefazClient {
  private certInfo: CertificateInfo;
  private xmlSigner: XMLSigner;

  constructor(certInfo: CertificateInfo) {
    this.certInfo = certInfo;
    this.xmlSigner = new XMLSigner(certInfo);
  }

  async enviarNFCe(xmlNFCe: string, uf: string, ambiente: 'producao' | 'homologacao'): Promise<SefazResponse> {
    try {
      console.log('Assinando XML da NFC-e...');
      const xmlAssinado = this.xmlSigner.signXML(xmlNFCe);
      
      console.log('Preparando envelope SOAP...');
      const soapEnvelope = this.createSoapEnvelope(xmlAssinado);
      
      const endpoint = getSefazEndpoint(uf, ambiente);
      console.log('Enviando para Sefaz:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeRecepcao/nfeRecepcaoLote'
        },
        body: soapEnvelope
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlResponse = await response.text();
      console.log('Resposta da Sefaz recebida');
      
      return parseSefazResponse(xmlResponse);
    } catch (error) {
      console.error('Erro ao comunicar com Sefaz:', error);
      return {
        success: false,
        cStat: '999',
        xMotivo: `Erro de comunicação: ${error.message}`,
        xmlRetorno: ''
      };
    }
  }

  async consultarNFCe(chaveAcesso: string, uf: string, ambiente: 'producao' | 'homologacao'): Promise<SefazResponse> {
    try {
      const xmlConsulta = this.createConsultaXML(chaveAcesso, ambiente);
      const soapEnvelope = this.createSoapEnvelope(xmlConsulta, 'nfeConsultaNF');
      
      const endpoint = getSefazEndpoint(uf, ambiente).replace('NfceRecepcao', 'NfceConsulta');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsulta/nfeConsultaNF'
        },
        body: soapEnvelope
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlResponse = await response.text();
      return parseSefazResponse(xmlResponse);
    } catch (error) {
      console.error('Erro ao consultar NFC-e:', error);
      return {
        success: false,
        cStat: '999',
        xMotivo: `Erro de consulta: ${error.message}`,
        xmlRetorno: ''
      };
    }
  }

  async cancelarNFCe(chaveAcesso: string, protocolo: string, motivo: string, uf: string, ambiente: 'producao' | 'homologacao'): Promise<SefazResponse> {
    try {
      const xmlCancelamento = this.createCancelamentoXML(chaveAcesso, protocolo, motivo, ambiente);
      const xmlAssinado = this.xmlSigner.signXML(xmlCancelamento);
      const soapEnvelope = this.createSoapEnvelope(xmlAssinado, 'nfeCancelamento');
      
      const endpoint = getSefazEndpoint(uf, ambiente).replace('NfceRecepcao', 'NfceCancelamento');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeCancelamento/nfeCancelamento'
        },
        body: soapEnvelope
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlResponse = await response.text();
      return parseSefazResponse(xmlResponse);
    } catch (error) {
      console.error('Erro ao cancelar NFC-e:', error);
      return {
        success: false,
        cStat: '999',
        xMotivo: `Erro de cancelamento: ${error.message}`,
        xmlRetorno: ''
      };
    }
  }

  private createSoapEnvelope(xmlContent: string, operation: string = 'nfeRecepcaoLote'): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfeRecepcao">
  <soap:Header />
  <soap:Body>
    <nfe:${operation}>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:${operation}>
  </soap:Body>
</soap:Envelope>`;
  }

  private createConsultaXML(chaveAcesso: string, ambiente: 'producao' | 'homologacao'): string {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    
    return `<?xml version="1.0" encoding="utf-8"?>
<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chNFe>${chaveAcesso}</chNFe>
</consSitNFe>`;
  }

  private createCancelamentoXML(chaveAcesso: string, protocolo: string, motivo: string, ambiente: 'producao' | 'homologacao'): string {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const id = `ID110111${chaveAcesso}01`;
    
    return `<?xml version="1.0" encoding="utf-8"?>
<cancNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <infCanc Id="${id}">
    <tpAmb>${tpAmb}</tpAmb>
    <xServ>CANCELAR</xServ>
    <chNFe>${chaveAcesso}</chNFe>
    <nProt>${protocolo}</nProt>
    <xJust>${motivo}</xJust>
  </infCanc>
</cancNFe>`;
  }
}
