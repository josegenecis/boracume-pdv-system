
import forge from 'npm:node-forge@1.3.1';

export interface CertificateInfo {
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  subject: string;
  issuer: string;
}

export function loadCertificateFromBase64(base64Data: string, password: string): CertificateInfo {
  try {
    // Decodificar base64
    const p12Data = forge.util.decode64(base64Data);
    
    // Carregar PKCS#12
    const p12Asn1 = forge.asn1.fromDer(p12Data);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Extrair certificado e chave privada
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    
    if (!certBags[forge.pki.oids.certBag] || !keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]) {
      throw new Error('Certificado ou chave privada não encontrados no arquivo PKCS#12');
    }
    
    const certificate = certBags[forge.pki.oids.certBag][0].cert!;
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key!;
    
    return {
      certificate,
      privateKey,
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      subject: certificate.subject.getField('CN')?.value || '',
      issuer: certificate.issuer.getField('CN')?.value || ''
    };
  } catch (error) {
    throw new Error(`Erro ao carregar certificado: ${error.message}`);
  }
}

export function validateCertificate(certInfo: CertificateInfo): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = new Date();
  
  // Verificar se o certificado está dentro da validade
  if (now < certInfo.validFrom) {
    errors.push('Certificado ainda não é válido');
  }
  
  if (now > certInfo.validTo) {
    errors.push('Certificado expirado');
  }
  
  // Verificar se é um certificado A1 válido para NFC-e
  const cnpjPattern = /CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
  if (!cnpjPattern.test(certInfo.subject)) {
    errors.push('Certificado não contém CNPJ válido');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
