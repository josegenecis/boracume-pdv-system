import { SignedXml } from 'npm:xml-crypto@6.1.2';
import { CertificateInfo } from './certificate-utils.ts';

export class XMLSigner {
  constructor(private certInfo: CertificateInfo) {}

  signXML(xmlContent: string): string {
    try {
      const referenceName = xmlContent.includes('<infEvento') ? 'infEvento' : 'infNFe';
      const targetName = referenceName === 'infEvento' ? 'evento' : 'NFe';
      const sign = new SignedXml({
        privateKey: this.certInfo.privateKeyPem,
        publicCert: this.certInfo.certificatePem,
        idAttribute: 'Id',
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      });

      sign.addReference({
        xpath: `//*[local-name(.)='${referenceName}']`,
        transforms: [
          'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      });

      sign.computeSignature(xmlContent, {
        location: {
          reference: `//*[local-name(.)='${targetName}']`,
          action: 'append',
        },
      });

      return sign.getSignedXml();
    } catch (error) {
      throw new Error(`Erro ao assinar XML: ${getErrorMessage(error)}`);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}
