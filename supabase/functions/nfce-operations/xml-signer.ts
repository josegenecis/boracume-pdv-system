
import forge from 'npm:node-forge@1.3.1';
import { DOMParser, XMLSerializer } from 'npm:xmldom@0.6.0';
import { CertificateInfo } from './certificate-utils.ts';

export class XMLSigner {
  private certInfo: CertificateInfo;

  constructor(certInfo: CertificateInfo) {
    this.certInfo = certInfo;
  }

  signXML(xmlContent: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Encontrar o elemento infNFe para assinar
      const infNFeElement = doc.getElementsByTagName('infNFe')[0];
      if (!infNFeElement) {
        throw new Error('Elemento infNFe não encontrado no XML');
      }

      // Gerar hash SHA-1 do elemento infNFe
      const canonicalXml = this.canonicalizeXml(infNFeElement);
      const hash = forge.md.sha1.create();
      hash.update(canonicalXml, 'utf8');
      const hashValue = forge.util.encode64(hash.digest().bytes());

      // Criar SignedInfo
      const signedInfo = this.createSignedInfo(infNFeElement.getAttribute('Id')!, hashValue);
      
      // Assinar o SignedInfo
      const signedInfoCanonical = this.canonicalizeXml(signedInfo);
      const signature = this.signData(signedInfoCanonical);

      // Criar elemento Signature
      const signatureElement = this.createSignatureElement(signedInfo, signature, hashValue);

      // Inserir assinatura no XML
      const nfeElement = doc.getElementsByTagName('NFe')[0];
      nfeElement.appendChild(signatureElement);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      throw new Error(`Erro ao assinar XML: ${error.message}`);
    }
  }

  private canonicalizeXml(element: any): string {
    // Implementação simplificada de canonicalização C14N
    const serializer = new XMLSerializer();
    return serializer.serializeToString(element)
      .replace(/>\s+</g, '><')
      .trim();
  }

  private createSignedInfo(referenceId: string, hashValue: string): any {
    const parser = new DOMParser();
    const signedInfoXml = `
      <SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="#${referenceId}">
          <Transforms>
            <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
          </Transforms>
          <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
          <DigestValue>${hashValue}</DigestValue>
        </Reference>
      </SignedInfo>`;
    
    return parser.parseFromString(signedInfoXml, 'text/xml').documentElement;
  }

  private signData(data: string): string {
    const md = forge.md.sha1.create();
    md.update(data, 'utf8');
    const signature = this.certInfo.privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  private createSignatureElement(signedInfo: any, signatureValue: string, hashValue: string): any {
    const parser = new DOMParser();
    const cert64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(this.certInfo.certificate)).getBytes());
    
    const signatureXml = `
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        ${new XMLSerializer().serializeToString(signedInfo)}
        <SignatureValue>${signatureValue}</SignatureValue>
        <KeyInfo>
          <X509Data>
            <X509Certificate>${cert64}</X509Certificate>
          </X509Data>
        </KeyInfo>
      </Signature>`;
    
    return parser.parseFromString(signatureXml, 'text/xml').documentElement;
  }
}
