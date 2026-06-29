import forge from 'npm:node-forge@1.3.1';

export interface CertificateInfo {
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  certificatePem: string;
  certificateChainPem: string;
  certificateChainCount: number;
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

    const certificateChainPem = buildCertificateChainPem(certificate, certificateEntries.map((entry: any) => entry.certificate));

    return {
      certificate,
      privateKey,
      certificatePem: forge.pki.certificateToPem(certificate),
      certificateChainPem,
      certificateChainCount: countPemCertificates(certificateChainPem),
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
      serialNumber: certificate.serialNumber,
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      subject: attributesToText(certificate.subject.attributes),
      issuer: attributesToText(certificate.issuer.attributes),
      cnpj: selected?.cnpj || extractCnpjFromCertificate(certificate)
    };
  } catch (error) {
    throw new Error(`Erro ao carregar certificado: ${getErrorMessage(error)}`);
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

function getAttributeValue(certificate: forge.pki.Certificate, names: string[]): string {
  for (const attr of certificate.subject.attributes as any[]) {
    const key = String(attr.shortName || attr.name || '').toLowerCase();
    if (names.some((name) => key === name.toLowerCase())) {
      return String(attr.value || '').trim();
    }
  }
  return '';
}

function extractCnpjFromText(value?: string): string | undefined {
  const match = String(value || '').match(/(?:CNPJ[:=\s]*)?(\d{14})\b/);
  return match?.[1];
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

function certKey(certificate: forge.pki.Certificate): string {
  return `${certificate.serialNumber}|${attributesToText(certificate.subject.attributes)}`;
}

function namesMatch(a: forge.pki.Certificate['subject'], b: forge.pki.Certificate['issuer']): boolean {
  return attributesToText(a.attributes) === attributesToText(b.attributes);
}

function buildCertificateChainPem(leaf: forge.pki.Certificate, certificates: forge.pki.Certificate[]): string {
  const all = (certificates || []).filter(Boolean);
  const byKey = new Map(all.map((cert) => [certKey(cert), cert]));
  const ordered: forge.pki.Certificate[] = [leaf];
  const used = new Set([certKey(leaf)]);
  let current = leaf;

  for (let i = 0; i < all.length; i++) {
    const issuer = all.find((candidate) =>
      !used.has(certKey(candidate)) && namesMatch(candidate.subject, current.issuer)
    );
    if (!issuer) break;
    ordered.push(issuer);
    used.add(certKey(issuer));
    current = issuer;
  }

  for (const cert of all) {
    const key = certKey(cert);
    if (!used.has(key)) {
      ordered.push(cert);
      used.add(key);
    }
  }

  return ordered
    .map((cert) => forge.pki.certificateToPem(byKey.get(certKey(cert)) || cert))
    .join('');
}

function countPemCertificates(value: string): number {
  return (String(value || '').match(/-----BEGIN CERTIFICATE-----/g) || []).length;
}

function extractCnpjFromSubject(certificate: forge.pki.Certificate): string | undefined {
  const commonName = getAttributeValue(certificate, ['CN', 'commonName']);
  const commonNameCnpj = extractCnpjFromText(commonName);
  if (commonNameCnpj) return commonNameCnpj;

  const subjectText = certificate.subject.attributes.map((attr: any) => String(attr.value || '')).join(' ');
  return extractCnpjFromText(subjectText);
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido');
}
