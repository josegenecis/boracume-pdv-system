
import { createHash } from 'node:crypto';

export function generateQRCodeData(
  chaveAcesso: string,
  uf: string,
  ambiente: 'producao' | 'homologacao',
  dataEmissao: string,
  valorTotal: number,
  cpfCnpjConsumidor?: string,
  cscId?: string,
  cscToken?: string
): string {
  try {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    const dhEmi = Math.floor(new Date(dataEmissao).getTime() / 1000).toString(16).toUpperCase();
    const vNF = Math.floor(valorTotal * 100).toString(); // Valor em centavos
    
    // Montar dados básicos
    let qrData = `chNFe=${chaveAcesso}&nVersao=100&tpAmb=${tpAmb}&dhEmi=${dhEmi}&vNF=${vNF}&vICMS=0&digVal=${chaveAcesso.slice(-1)}`;
    
    // Adicionar CPF/CNPJ se informado
    if (cpfCnpjConsumidor) {
      const documento = cpfCnpjConsumidor.replace(/\D/g, '');
      if (documento.length === 11) {
        qrData += `&cDest=${documento}`;
      } else if (documento.length === 14) {
        qrData += `&cDest=${documento}`;
      }
    }
    
    // Gerar hash HMAC-SHA1 se CSC estiver configurado
    if (cscId && cscToken) {
      const hashData = qrData + cscToken;
      const hash = createHash('sha1').update(hashData).digest('hex').toUpperCase();
      qrData += `&cHashQRCode=${hash}`;
    }
    
    // URL base para consulta
    const baseUrl = getQRCodeBaseUrl(uf, ambiente);
    
    return `${baseUrl}?${qrData}`;
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    throw new Error(`Erro ao gerar QR Code: ${error.message}`);
  }
}

function getQRCodeBaseUrl(uf: string, ambiente: 'producao' | 'homologacao'): string {
  const subdomain = ambiente === 'producao' ? 'www' : 'hom';
  
  // URLs específicas por UF
  const urls: { [key: string]: string } = {
    'AC': `https://${subdomain}.sefaznet.ac.gov.br/nfce/consulta`,
    'AL': `https://${subdomain}.sefaz.al.gov.br/nfce/consulta`,
    'AP': `https://${subdomain}.sefaz.ap.gov.br/nfce/consulta`,
    'AM': `https://${subdomain}.sefaz.am.gov.br/nfce/consulta`,
    'BA': `https://${subdomain}.sefaz.ba.gov.br/nfce/consulta`,
    'CE': `https://${subdomain}.sefaz.ce.gov.br/nfce/consulta`,
    'DF': `https://${subdomain}.fazenda.df.gov.br/nfce/consulta`,
    'ES': `https://${subdomain}.sefaz.es.gov.br/nfce/consulta`,
    'GO': `https://${subdomain}.sefaz.go.gov.br/nfce/consulta`,
    'MA': `https://${subdomain}.sefaz.ma.gov.br/nfce/consulta`,
    'MT': `https://${subdomain}.sefaz.mt.gov.br/nfce/consulta`,
    'MS': `https://${subdomain}.sefaz.ms.gov.br/nfce/consulta`,
    'MG': `https://${subdomain}.fazenda.mg.gov.br/nfce/consulta`,
    'PA': `https://${subdomain}.sefa.pa.gov.br/nfce/consulta`,
    'PB': `https://${subdomain}.receita.pb.gov.br/nfce/consulta`,
    'PR': `https://${subdomain}.fazenda.pr.gov.br/nfce/consulta`,
    'PE': `https://${subdomain}.sefaz.pe.gov.br/nfce/consulta`,
    'PI': `https://${subdomain}.sefaz.pi.gov.br/nfce/consulta`,
    'RJ': `https://${subdomain}.fazenda.rj.gov.br/nfce/consulta`,
    'RN': `https://${subdomain}.set.rn.gov.br/nfce/consulta`,
    'RS': `https://${subdomain}.sefazrs.rs.gov.br/nfce/consulta`,
    'RO': `https://${subdomain}.sefin.ro.gov.br/nfce/consulta`,
    'RR': `https://${subdomain}.sefaz.rr.gov.br/nfce/consulta`,
    'SC': `https://${subdomain}.sef.sc.gov.br/nfce/consulta`,
    'SP': `https://${subdomain}.fazenda.sp.gov.br/nfce/consulta`,
    'SE': `https://${subdomain}.sefaz.se.gov.br/nfce/consulta`,
    'TO': `https://${subdomain}.sefaz.to.gov.br/nfce/consulta`
  };
  
  return urls[uf] || urls['SP']; // Fallback para SP
}
