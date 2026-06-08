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
    const keyBagList = [
      ...(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
      ...(plainKeyBags[forge.pki.oids.keyBag] || []),
    ];
    const privateKeyBag = keyBagList.find((bag: any) => bag?.key);
    const privateKey = privateKeyBag?.key;
    const privateKeyLocalId = getBagLocalKeyId(privateKeyBag);
    const certificateEntries = (certBags[forge.pki.oids.certBag] || [])
      .map((bag: any) => ({ certificate: bag?.cert, localKeyId: getBagLocalKeyId(bag) }))
      .filter((entry: any) => entry.certificate);
    const linkedCertificate = certificateEntries.find((entry: any) =>
      privateKey && (
        (privateKeyLocalId && entry.localKeyId === privateKeyLocalId) ||
        publicKeyMatchesPrivateKey(entry.certificate, privateKey)
      )
    )?.certificate;
    const rankedCertificates = certificateEntries
      .map((entry: any) => {
        const subjectCnpj = extractCnpjFromSubject(entry.certificate);
        const anyCnpj = extractCnpjFromCertificate(entry.certificate);
        let score = 0;
        if (subjectCnpj) score += 100;
        if (anyCnpj) score += 30;
        if (!isCertificateAuthority(entry.certificate)) score += 40;
        return { certificate: entry.certificate, cnpj: subjectCnpj || anyCnpj, score };
      })
      .sort((a: any, b: any) => b.score - a.score);
    const linkedCnpj = linkedCertificate ? extractCnpjFromSubject(linkedCertificate) || extractCnpjFromCertificate(linkedCertificate) : '';
    const selected = linkedCertificate && linkedCnpj
      ? { certificate: linkedCertificate, cnpj: linkedCnpj, score: Number.MAX_SAFE_INTEGER }
      : rankedCertificates.find((item: any) => item.cnpj && !isCertificateAuthority(item.certificate)) ||
        rankedCertificates.find((item: any) => item.cnpj) ||
        rankedCertificates[0];
    const certificate = selected?.certificate;

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
      cnpj: selected?.cnpj || extractCnpjFromCertificate(certificate)
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

function getBagLocalKeyId(bag: any): string {
  const raw = Array.isArray(bag?.attributes?.localKeyId)
    ? bag.attributes.localKeyId[0]
    : bag?.attributes?.localKeyId;
  if (!raw) return '';
  return forge.util.bytesToHex(String(raw));
}

function publicKeyMatchesPrivateKey(certificate: forge.pki.Certificate, privateKey: forge.pki.PrivateKey): boolean {
  const certPublicKey = certificate.publicKey as any;
  const key = privateKey as any;
  return Boolean(certPublicKey?.n && certPublicKey?.e && key?.n && key?.e && certPublicKey.n.equals(key.n) && certPublicKey.e.equals(key.e));
}

function isCertificateAuthority(certificate: forge.pki.Certificate): boolean {
  return (certificate.extensions || []).some((extension: any) =>
    String(extension.name || '').toLowerCase() === 'basicconstraints' && extension.cA === true
  );
}

function extractCnpjFromSubject(certificate: forge.pki.Certificate): string | undefined {
  const subjectText = certificate.subject.attributes.map((attr: any) => String(attr.value || '')).join(' ');
  const subjectMatch = subjectText.match(/(?:CNPJ[:=\s]*)?(\d{14})\b/);
  return subjectMatch?.[1];
}

function extractCnpjFromCertificate(certificate: forge.pki.Certificate): string | undefined {
  const subjectCnpj = extractCnpjFromSubject(certificate);
  if (subjectCnpj) return subjectCnpj;

  for (const extension of certificate.extensions || []) {
    const value = String((extension as any).value || '');
    const match = value.match(/(\d{14})/);
    if (match) return match[1];
  }

  return undefined;
}
