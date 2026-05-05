import forge from 'npm:node-forge@1.3.1';
import { DOMParser, XMLSerializer } from 'npm:xmldom@0.6.0';
import { CertificateInfo } from './certificate-utils.ts';

export class XMLSigner {
  constructor(private certInfo: CertificateInfo) {}

  signXML(xmlContent: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      const signedElement = doc.getElementsByTagName('infNFe')[0] || doc.getElementsByTagName('infEvento')[0];
      if (!signedElement) {
        throw new Error('Elemento infNFe/infEvento nao encontrado no XML');
      }

      const referenceId = signedElement.getAttribute('Id');
      if (!referenceId) {
        throw new Error('Elemento a assinar nao possui atributo Id');
      }

      const hashValue = this.digestElement(signedElement);
      const signedInfo = this.createSignedInfo(referenceId, hashValue);
      const signatureValue = this.signData(this.canonicalizeXml(signedInfo));
      const signatureElement = this.createSignatureElement(signedInfo, signatureValue);
      const targetElement = doc.getElementsByTagName('NFe')[0] || doc.getElementsByTagName('evento')[0];
      if (!targetElement) {
        throw new Error('Elemento raiz NFe/evento nao encontrado');
      }
      targetElement.appendChild(signatureElement);

      return new XMLSerializer().serializeToString(doc);
    } catch (error) {
      throw new Error(`Erro ao assinar XML: ${error.message}`);
    }
  }

  private digestElement(element: any): string {
    const hash = forge.md.sha1.create();
    hash.update(this.canonicalizeXml(element), 'utf8');
    return forge.util.encode64(hash.digest().bytes());
  }

  private canonicalizeXml(element: any): string {
    return new XMLSerializer()
      .serializeToString(element)
      .replace(/>\s+</g, '><')
      .replace(/\s+xmlns(:\w+)?=""/g, '')
      .trim();
  }

  private createSignedInfo(referenceId: string, hashValue: string): any {
    const parser = new DOMParser();
    const signedInfoXml = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${referenceId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${hashValue}</DigestValue></Reference></SignedInfo>`;
    return parser.parseFromString(signedInfoXml, 'text/xml').documentElement;
  }

  private signData(data: string): string {
    const md = forge.md.sha1.create();
    md.update(data, 'utf8');
    return forge.util.encode64(this.certInfo.privateKey.sign(md));
  }

  private createSignatureElement(signedInfo: any, signatureValue: string): any {
    const parser = new DOMParser();
    const cert64 = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(this.certInfo.certificate)).getBytes()
    );
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${new XMLSerializer().serializeToString(signedInfo)}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cert64}</X509Certificate></X509Data></KeyInfo></Signature>`;
    return parser.parseFromString(signatureXml, 'text/xml').documentElement;
  }
}
