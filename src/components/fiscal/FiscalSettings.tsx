
import React, { useState, useEffect } from 'react';
import forge from 'node-forge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Receipt, Settings, FileText, Upload, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { IntegerInput } from '@/components/ui/integer-input';

interface FiscalConfig {
  id?: string;
  cnpj: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_municipio: string;
  endereco_uf: string;
  endereco_cep: string;
  codigo_municipio: string;
  nfce_serie: string;
  nfce_numero_atual: number;
  certificado_a1_base64: string;
  certificado_senha: string;
  ambiente: string;
  regime_tributario: number;
  csc_id: string;
  csc_token: string;
  ativo: boolean;
}

type ParsedCertificateInfo = {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  serialNumber?: string;
  validFrom?: Date;
  validTo?: Date;
  issuer?: string;
  subject?: string;
};

type CnpjRegistrationData = {
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigo_municipio?: string;
  inscricao_estadual?: string;
};

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '');

const formatCnpj = (value?: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length !== 14) return digits;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const formatCertificateDate = (value?: Date) => {
  if (!value) return '';
  return value.toLocaleDateString('pt-BR');
};

const attributesToText = (attributes: any[] = []) =>
  attributes.map((attr: any) => `${attr.shortName || attr.name}=${attr.value}`).join(', ');

const getAttributeValue = (certificate: forge.pki.Certificate, names: string[]) => {
  for (const attr of certificate.subject.attributes as any[]) {
    const key = String(attr.shortName || attr.name || '').toLowerCase();
    if (names.some((name) => key === name.toLowerCase())) {
      return String(attr.value || '').trim();
    }
  }
  return '';
};

const extractCnpjFromText = (value?: string): string => {
  const match = String(value || '').match(/(?:CNPJ[:=\s]*)?(\d{14})\b/);
  return match?.[1] || '';
};

const extractCnpjFromSubject = (certificate: forge.pki.Certificate): string => {
  const commonName = getAttributeValue(certificate, ['CN', 'commonName']);
  const commonNameCnpj = extractCnpjFromText(commonName);
  if (commonNameCnpj) return commonNameCnpj;

  const subjectValues = (certificate.subject.attributes as any[]).map((attr) => String(attr.value || ''));
  const subjectText = subjectValues.join(' ');
  return extractCnpjFromText(subjectText);
};

const isCertificateAuthority = (certificate: forge.pki.Certificate): boolean => {
  return (certificate.extensions || []).some((extension: any) =>
    String(extension.name || '').toLowerCase() === 'basicconstraints' && extension.cA === true
  );
};

const looksLikeIssuerName = (value?: string) => {
  return /\b(autoridade|certificadora|certificacao digital|certificação digital|ac\s|icp-brasil|serasa|certisign|valid|soluti|safeweb|caixa|receita federal)\b/i.test(String(value || ''));
};

const getBagLocalKeyId = (bag: any): string => {
  const raw = Array.isArray(bag?.attributes?.localKeyId)
    ? bag.attributes.localKeyId[0]
    : bag?.attributes?.localKeyId;
  if (!raw) return '';
  return forge.util.bytesToHex(String(raw));
};

const publicKeyMatchesPrivateKey = (certificate: forge.pki.Certificate, privateKey: forge.pki.PrivateKey) => {
  const certPublicKey = certificate.publicKey as any;
  const key = privateKey as any;
  return Boolean(certPublicKey?.n && certPublicKey?.e && key?.n && key?.e && certPublicKey.n.equals(key.n) && certPublicKey.e.equals(key.e));
};

const extractCnpjFromCertificate = (certificate: forge.pki.Certificate): string => {
  const subjectCnpj = extractCnpjFromSubject(certificate);
  if (subjectCnpj) return subjectCnpj;

  for (const extension of certificate.extensions || []) {
    const value = String((extension as any).value || '');
    const match = value.match(/(\d{14})/);
    if (match) return match[1];
  }

  return '';
};

const cleanCompanyNameFromCertificate = (value?: string, cnpj?: string) => {
  const cnpjDigits = onlyDigits(cnpj);
  let cleanValue = String(value || '');
  if (cnpjDigits) {
    cleanValue = cleanValue.replace(new RegExp(`[:\\s-]*${cnpjDigits}\\b`), '');
  }
  return cleanValue
    .replace(/[:\s-]*\d{14}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const parseCertificateBase64 = (base64Data: string, password: string): ParsedCertificateInfo => {
  const p12Data = forge.util.decode64(base64Data);
  const p12Asn1 = forge.asn1.fromDer(p12Data);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  const privateKeyBag = keyBags.find((bag: any) => bag?.key);
  const privateKey = privateKeyBag?.key as forge.pki.PrivateKey | undefined;
  const privateKeyLocalId = getBagLocalKeyId(privateKeyBag);
  const certificateEntries = (certBags[forge.pki.oids.certBag] || [])
    .map((bag: any) => ({ certificate: bag?.cert as forge.pki.Certificate | undefined, localKeyId: getBagLocalKeyId(bag) }))
    .filter((entry) => entry.certificate);
  const certificates = certificateEntries
    .map((entry) => entry.certificate)
    .filter(Boolean) as forge.pki.Certificate[];
  const linkedCertificate = certificateEntries.find((entry) =>
    privateKey && (
      (privateKeyLocalId && entry.localKeyId === privateKeyLocalId) ||
      publicKeyMatchesPrivateKey(entry.certificate!, privateKey)
    )
  )?.certificate;
  const rankedCertificates = certificates
    .map((certificate) => {
      const commonName = getAttributeValue(certificate, ['CN', 'commonName']);
      const subjectCnpj = extractCnpjFromSubject(certificate);
      const anyCnpj = extractCnpjFromCertificate(certificate);
      let score = 0;
      if (subjectCnpj) score += 100;
      if (anyCnpj) score += 30;
      if (!isCertificateAuthority(certificate)) score += 40;
      if (!looksLikeIssuerName(commonName)) score += 10;
      return { certificate, cnpj: subjectCnpj || anyCnpj, score };
    })
    .sort((a, b) => b.score - a.score);
  const linkedCnpj = linkedCertificate ? extractCnpjFromSubject(linkedCertificate) || extractCnpjFromCertificate(linkedCertificate) : '';
  const selected = linkedCertificate && linkedCnpj
    ? { certificate: linkedCertificate, cnpj: linkedCnpj, score: Number.MAX_SAFE_INTEGER }
    : rankedCertificates.find((item) => item.cnpj && !isCertificateAuthority(item.certificate)) ||
    rankedCertificates.find((item) => item.cnpj) ||
    rankedCertificates[0];
  const certificate = selected?.certificate;

  if (!certificate) {
    throw new Error('Certificado nao encontrado no arquivo A1.');
  }

  const cnpj = selected?.cnpj || extractCnpjFromCertificate(certificate);
  if (!cnpj) {
    throw new Error('Nao encontrei CNPJ de titular no certificado. Confira se o arquivo A1 pertence a empresa cliente.');
  }

  const commonName = getAttributeValue(certificate, ['CN', 'commonName']);
  const organization = getAttributeValue(certificate, ['O', 'organizationName']);
  const organizationalUnit = getAttributeValue(certificate, ['OU', 'organizationalUnitName']);
  const commonNameCnpj = extractCnpjFromText(commonName);
  const titularName = cleanCompanyNameFromCertificate(commonName, commonNameCnpj || cnpj);
  const razaoSocial = cleanCompanyNameFromCertificate(
    titularName && !looksLikeIssuerName(titularName) ? titularName : organization,
    cnpj
  );

  return {
    cnpj,
    razaoSocial,
    nomeFantasia: cleanCompanyNameFromCertificate(
      !looksLikeIssuerName(organization) ? organization : organizationalUnit,
      cnpj
    ),
    serialNumber: certificate.serialNumber,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
    subject: attributesToText(certificate.subject.attributes as any[]),
    issuer: attributesToText(certificate.issuer.attributes as any[]),
  };
};

const fetchCnpjRegistrationData = async (cnpj: string): Promise<CnpjRegistrationData | null> => {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!response.ok) return null;

  const data = await response.json();
  const inscricoesEstaduais = Array.isArray(data?.inscricoes_estaduais) ? data.inscricoes_estaduais : [];
  const activeIe = inscricoesEstaduais.find((item: any) => item?.ativo !== false) || inscricoesEstaduais[0];

  return {
    razao_social: data?.razao_social || data?.nome,
    nome_fantasia: data?.nome_fantasia || data?.fantasia,
    logradouro: data?.logradouro,
    numero: data?.numero,
    complemento: data?.complemento,
    bairro: data?.bairro,
    municipio: data?.municipio,
    uf: data?.uf,
    cep: data?.cep,
    codigo_municipio: data?.codigo_municipio || data?.municipio_codigo,
    inscricao_estadual: activeIe?.inscricao_estadual || activeIe?.ie,
  };
};

const isRegistrationCompatibleWithCertificate = (
  registration: CnpjRegistrationData | null | undefined,
  info: ParsedCertificateInfo
) => {
  if (!registration) return false;

  const registrationName = String(registration.razao_social || registration.nome_fantasia || '').trim();
  if (!registrationName) return true;
  if (looksLikeIssuerName(registrationName) && info.razaoSocial && !looksLikeIssuerName(info.razaoSocial)) {
    return false;
  }

  return true;
};

const FiscalSettings: React.FC = () => {
  const [settings, setSettings] = useState<FiscalConfig>({
    cnpj: '',
    inscricao_estadual: '',
    razao_social: '',
    nome_fantasia: '',
    endereco_logradouro: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_municipio: '',
    endereco_uf: '',
    endereco_cep: '',
    codigo_municipio: '',
    nfce_serie: '1',
    nfce_numero_atual: 1,
    certificado_a1_base64: '',
    certificado_senha: '',
    ambiente: 'homologacao',
    regime_tributario: 1,
    csc_id: '',
    csc_token: '',
    ativo: false
  });
  const [loading, setLoading] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateInfo, setCertificateInfo] = useState<ParsedCertificateInfo | null>(null);
  const [certificateAutofillLoading, setCertificateAutofillLoading] = useState(false);
  const [nfceNumeroRaw, setNfceNumeroRaw] = useState('1');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadFiscalSettings();
    }
  }, [user]);

  useEffect(() => {
    if (!settings.certificado_a1_base64 || !settings.certificado_senha || certificateInfo) return;
    void tryApplyCertificateAutofill(settings.certificado_a1_base64, settings.certificado_senha, { silent: true });
  }, [settings.certificado_a1_base64, settings.certificado_senha, certificateInfo]);

  const loadFiscalSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          cnpj: data.cnpj || '',
          inscricao_estadual: data.inscricao_estadual || '',
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          endereco_logradouro: data.endereco_logradouro || '',
          endereco_numero: data.endereco_numero || '',
          endereco_complemento: data.endereco_complemento || '',
          endereco_bairro: data.endereco_bairro || '',
          endereco_municipio: data.endereco_municipio || '',
          endereco_uf: data.endereco_uf || '',
          endereco_cep: data.endereco_cep || '',
          codigo_municipio: data.codigo_municipio || '',
          nfce_serie: data.nfce_serie || '1',
          nfce_numero_atual: data.nfce_numero_atual || 1,
          certificado_a1_base64: data.certificado_a1_base64 || '',
          certificado_senha: data.certificado_senha || '',
          ambiente: data.ambiente || 'homologacao',
          regime_tributario: data.regime_tributario || 1,
          csc_id: data.csc_id || '',
          csc_token: data.csc_token || '',
          ativo: data.ativo || false
        });
        setNfceNumeroRaw(String(data.nfce_numero_atual || 1));
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações fiscais.",
        variant: "destructive"
      });
    }
  };

  const handleCertificateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast({
        title: "Erro",
        description: "Apenas arquivos .pfx ou .p12 são aceitos para certificados A1.",
        variant: "destructive"
      });
      return;
    }

    setCertificateFile(file);
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      const base64Content = base64String.split(',')[1]; // Remove data:application/... prefix
      setCertificateInfo(null);
      setSettings(prev => ({ ...prev, certificado_a1_base64: base64Content }));
      if (settings.certificado_senha) {
        void tryApplyCertificateAutofill(base64Content, settings.certificado_senha);
      } else {
        toast({
          title: "Certificado carregado",
          description: "Informe a senha do certificado para preencher os dados automaticamente.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const applyCertificateInfo = (info: ParsedCertificateInfo, registration?: CnpjRegistrationData | null) => {
    const safeRegistration = isRegistrationCompatibleWithCertificate(registration, info) ? registration : null;
    setCertificateInfo(info);
    setSettings(prev => ({
      ...prev,
      cnpj: info.cnpj ? formatCnpj(info.cnpj) : prev.cnpj,
      inscricao_estadual: safeRegistration?.inscricao_estadual || prev.inscricao_estadual,
      razao_social: info.razaoSocial || safeRegistration?.razao_social || prev.razao_social,
      nome_fantasia: info.nomeFantasia || safeRegistration?.nome_fantasia || prev.nome_fantasia || info.razaoSocial || '',
      endereco_logradouro: safeRegistration?.logradouro || prev.endereco_logradouro,
      endereco_numero: safeRegistration?.numero || prev.endereco_numero,
      endereco_complemento: safeRegistration?.complemento || prev.endereco_complemento,
      endereco_bairro: safeRegistration?.bairro || prev.endereco_bairro,
      endereco_municipio: safeRegistration?.municipio || prev.endereco_municipio,
      endereco_uf: safeRegistration?.uf || prev.endereco_uf,
      endereco_cep: safeRegistration?.cep || prev.endereco_cep,
      codigo_municipio: safeRegistration?.codigo_municipio ? String(safeRegistration.codigo_municipio) : prev.codigo_municipio,
    }));
  };

  const tryApplyCertificateAutofill = async (
    base64Content: string,
    password: string,
    options: { silent?: boolean } = {}
  ) => {
    if (!base64Content || !password) return;

    try {
      setCertificateAutofillLoading(true);
      const info = parseCertificateBase64(base64Content, password);
      let registration: CnpjRegistrationData | null = null;
      try {
        registration = info.cnpj ? await fetchCnpjRegistrationData(info.cnpj) : null;
      } catch (registrationError) {
        console.warn('Nao foi possivel consultar dados publicos do CNPJ', registrationError);
      }
      applyCertificateInfo(info, registration);
      if (!options.silent) {
        toast({
          title: "Dados preenchidos pelo certificado",
          description: `${registration?.razao_social || info.razaoSocial || 'Empresa'}${info.cnpj ? ` - ${formatCnpj(info.cnpj)}` : ''}`,
        });
      }
    } catch (error: any) {
      setCertificateInfo(null);
      if (!options.silent) {
        toast({
          title: "Não foi possível ler o certificado",
          description: error?.message || "Confira o arquivo e a senha do certificado A1.",
          variant: "destructive"
        });
      }
    } finally {
      setCertificateAutofillLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);

      // Validação básica
      if (!settings.cnpj || !settings.razao_social || !settings.endereco_logradouro) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive"
        });
        return;
      }

      const settingsData = {
        ...settings,
        user_id: user?.id,
        updated_at: new Date().toISOString()
      };

      let result;
      if (settings.id) {
        // Update existing
        const { id, ...updateData } = settingsData;
        result = await supabase
          .from('fiscal_settings')
          .update(updateData)
          .eq('id', settings.id);
      } else {
        // Insert new
        result = await supabase
          .from('fiscal_settings')
          .insert([settingsData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Sucesso",
        description: "Configurações fiscais salvas com sucesso!",
      });

      // Reload settings to get the ID if it was a new insert
      if (!settings.id) {
        loadFiscalSettings();
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações fiscais.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      
      if (!settings.id) {
        await saveSettings();
      }

      const { data, error } = await supabase.functions.invoke('nfce-operations', {
        body: { operation: 'testar_conexao' }
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.motivo || 'A Sefaz retornou falha no status do servico.');
      }
      
      toast({
        title: "Conexão testada",
        description: `Sefaz ${data.uf}/${data.ambiente}: ${data.cStat} - ${data.motivo}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro na conexão",
        description: error.message || "Erro ao testar conexão com a Sefaz.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCertificateImportSection = () => (
    <div className="space-y-4 rounded-2xl border border-[#FF6400]/15 bg-[#FFF8F2] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">Importar certificado digital A1</h3>
          <p className="mt-1 text-sm text-slate-600">
            Envie o .pfx/.p12 e informe a senha. O sistema usa o certificado do titular para preencher os dados da empresa cliente.
          </p>
        </div>
        <Upload className="mt-1 h-5 w-5 shrink-0 text-[#FF6400]" />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr,280px]">
        <div className="space-y-2">
          <Label>Arquivo do Certificado (.pfx/.p12)</Label>
          <Input
            type="file"
            accept=".pfx,.p12"
            onChange={handleCertificateUpload}
            className="bg-white"
          />
          {certificateFile && (
            <p className="text-sm text-green-700">Certificado carregado: {certificateFile.name}</p>
          )}
          {certificateAutofillLoading && (
            <p className="text-sm text-blue-700">Lendo certificado e preenchendo dados fiscais...</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Senha do Certificado</Label>
          <Input
            type="password"
            value={settings.certificado_senha}
            onChange={(e) => {
              const password = e.target.value;
              setSettings(prev => ({ ...prev, certificado_senha: password }));
              if (settings.certificado_a1_base64 && password) {
                void tryApplyCertificateAutofill(settings.certificado_a1_base64, password, { silent: true });
              }
            }}
            placeholder="senha123"
            className="bg-white"
          />
        </div>
      </div>

      {certificateInfo && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div className="space-y-1">
              <div className="font-semibold">Certificado do cliente lido e dados aplicados</div>
              <div>CNPJ: {formatCnpj(certificateInfo.cnpj) || 'não identificado'}</div>
              {certificateInfo.razaoSocial && <div>Razão social do titular: {certificateInfo.razaoSocial}</div>}
              <div>Validade: {formatCertificateDate(certificateInfo.validFrom)} até {formatCertificateDate(certificateInfo.validTo)}</div>
              {certificateInfo.issuer && <div className="text-green-800/80">Autoridade emissora: {certificateInfo.issuer}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Configurações Fiscais - NFC-e
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Switch
              id="fiscal-enabled"
              checked={settings.ativo}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ativo: checked }))}
            />
            <Label htmlFor="fiscal-enabled">Ativar emissão de NFC-e</Label>
          </div>

          {settings.ativo && (
            <>
              {renderCertificateImportSection()}

              {/* Dados da Empresa */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Dados da Empresa</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ *</Label>
                    <Input
                      value={settings.cnpj}
                      onChange={(e) => setSettings(prev => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Inscrição Estadual</Label>
                    <Input
                      value={settings.inscricao_estadual}
                      onChange={(e) => setSettings(prev => ({ ...prev, inscricao_estadual: e.target.value }))}
                      placeholder="000.000.000.000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Razão Social *</Label>
                    <Input
                      value={settings.razao_social}
                      onChange={(e) => setSettings(prev => ({ ...prev, razao_social: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={settings.nome_fantasia}
                      onChange={(e) => setSettings(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Endereço</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Logradouro *</Label>
                    <Input
                      value={settings.endereco_logradouro}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_logradouro: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Número *</Label>
                    <Input
                      value={settings.endereco_numero}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_numero: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={settings.endereco_complemento}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_complemento: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bairro *</Label>
                    <Input
                      value={settings.endereco_bairro}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_bairro: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>CEP *</Label>
                    <Input
                      value={settings.endereco_cep}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_cep: e.target.value }))}
                      placeholder="00000-000"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Município *</Label>
                    <Input
                      value={settings.endereco_municipio}
                      onChange={(e) => setSettings(prev => ({ ...prev, endereco_municipio: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>UF *</Label>
                    <Select 
                      value={settings.endereco_uf} 
                      onValueChange={(value) => setSettings(prev => ({ ...prev, endereco_uf: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AC">AC</SelectItem>
                        <SelectItem value="AL">AL</SelectItem>
                        <SelectItem value="AP">AP</SelectItem>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="BA">BA</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                        <SelectItem value="DF">DF</SelectItem>
                        <SelectItem value="ES">ES</SelectItem>
                        <SelectItem value="GO">GO</SelectItem>
                        <SelectItem value="MA">MA</SelectItem>
                        <SelectItem value="MT">MT</SelectItem>
                        <SelectItem value="MS">MS</SelectItem>
                        <SelectItem value="MG">MG</SelectItem>
                        <SelectItem value="PA">PA</SelectItem>
                        <SelectItem value="PB">PB</SelectItem>
                        <SelectItem value="PR">PR</SelectItem>
                        <SelectItem value="PE">PE</SelectItem>
                        <SelectItem value="PI">PI</SelectItem>
                        <SelectItem value="RJ">RJ</SelectItem>
                        <SelectItem value="RN">RN</SelectItem>
                        <SelectItem value="RS">RS</SelectItem>
                        <SelectItem value="RO">RO</SelectItem>
                        <SelectItem value="RR">RR</SelectItem>
                        <SelectItem value="SC">SC</SelectItem>
                        <SelectItem value="SP">SP</SelectItem>
                        <SelectItem value="SE">SE</SelectItem>
                        <SelectItem value="TO">TO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Código do Município *</Label>
                    <Input
                      value={settings.codigo_municipio}
                      onChange={(e) => setSettings(prev => ({ ...prev, codigo_municipio: e.target.value }))}
                      placeholder="3550308"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Configurações NFC-e */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configurações NFC-e</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Série NFC-e *</Label>
                    <Input
                      value={settings.nfce_serie}
                      onChange={(e) => setSettings(prev => ({ ...prev, nfce_serie: e.target.value }))}
                      placeholder="1"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Próximo Número</Label>
                    <IntegerInput
                      min={1}
                      value={nfceNumeroRaw}
                      fallback={settings.nfce_numero_atual || 1}
                      onValueChange={(value) => {
                        setNfceNumeroRaw(value);
                        if (value !== '') {
                          setSettings(prev => ({ ...prev, nfce_numero_atual: parseInt(value, 10) || 1 }));
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select 
                      value={settings.regime_tributario.toString()} 
                      onValueChange={(value) => setSettings(prev => ({ ...prev, regime_tributario: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Simples Nacional</SelectItem>
                        <SelectItem value="3">Regime Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select 
                    value={settings.ambiente} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, ambiente: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologação</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CSC - Código de Segurança do Contribuinte */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">CSC - Código de Segurança</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CSC ID</Label>
                    <Input
                      value={settings.csc_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, csc_id: e.target.value }))}
                      placeholder="000001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>CSC Token</Label>
                    <Input
                      type="password"
                      value={settings.csc_token}
                      onChange={(e) => setSettings(prev => ({ ...prev, csc_token: e.target.value }))}
                      placeholder="Token fornecido pela Sefaz"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={testConnection} disabled={loading} variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Testar Conexão
                </Button>
                <Button onClick={saveSettings} disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {settings.ativo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Últimas NFC-e Emitidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Nenhuma nota fiscal emitida ainda
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FiscalSettings;
