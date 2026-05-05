import forge from 'npm:node-forge@1.3.1';

export interface CertificateInfo {
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  certificatePem: string;
  privateKeyPem: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  subject: string;
  issuer: string;
  cnpj?: string;
}

export function loadCertificateFromBase64(base64Data: string, password: string): CertificateInfo {
  try {
    const p12Data = forge.util.decode64(base64Data);
    const p12Asn1 = forge.asn1.fromDer(p12Data);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    const privateKey =
      keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key ||
      plainKeyBags[forge.pki.oids.keyBag]?.[0]?.key;

    if (!certificate || !privateKey) {
      throw new Error('Certificado ou chave privada nao encontrados no arquivo PKCS#12');
    }

    return {
      certificate,
      privateKey,
      certificatePem: forge.pki.certificateToPem(certificate),
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      subject: attributesToText(certificate.subject.attributes),
      issuer: attributesToText(certificate.issuer.attributes),
      cnpj: extractCnpjFromCertificate(certificate)
    };
  } catch (error) {
    throw new Error(`Erro ao carregar certificado: ${error.message}`);
  }
}

export function validateCertificate(
  certInfo: CertificateInfo,
  expectedCnpj?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const now = new Date();

  if (now < certInfo.validFrom) {
    errors.push('Certificado ainda nao e valido');
  }

  if (now > certInfo.validTo) {
    errors.push('Certificado expirado');
  }

  if (!certInfo.cnpj) {
    errors.push('Certificado nao contem CNPJ valido');
  }

  const normalizedExpected = onlyDigits(expectedCnpj);
  if (normalizedExpected && certInfo.cnpj && certInfo.cnpj !== normalizedExpected) {
    errors.push('CNPJ do certificado diferente do CNPJ configurado');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function attributesToText(attributes: forge.pki.CertificateField[]): string {
  return attributes.map((attr: any) => `${attr.shortName || attr.name}=${attr.value}`).join(', ');
}

function onlyDigits(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function extractCnpjFromCertificate(certificate: forge.pki.Certificate): string | undefined {
  const subjectText = certificate.subject.attributes.map((attr: any) => String(attr.value || '')).join(' ');
  const subjectMatch = subjectText.match(/(?:CNPJ[:=\s]*)?(\d{14})\b/);
  if (subjectMatch) return subjectMatch[1];

  for (const extension of certificate.extensions || []) {
    const value = String((extension as any).value || '');
    const match = value.match(/(\d{14})/);
    if (match) return match[1];
  }

  return undefined;
}
