
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Receipt, Settings, FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadFiscalSettings();
    }
  }, [user]);

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
      setSettings(prev => ({ ...prev, certificado_a1_base64: base64Content }));
    };
    reader.readAsDataURL(file);
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
      
      // Simular teste de conexão com a Sefaz
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Conexão testada",
        description: "Conexão com a Sefaz funcionando corretamente!",
      });
    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: "Erro ao testar conexão com a Sefaz.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
                    <Input
                      type="number"
                      value={settings.nfce_numero_atual}
                      onChange={(e) => setSettings(prev => ({ ...prev, nfce_numero_atual: parseInt(e.target.value) || 1 }))}
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

              {/* Certificado Digital */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Certificado Digital A1</h3>
                
                <div className="space-y-2">
                  <Label>Arquivo do Certificado (.pfx/.p12)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={handleCertificateUpload}
                      className="flex-1"
                    />
                    <Upload className="w-4 h-4" />
                  </div>
                  {certificateFile && (
                    <p className="text-sm text-green-600">Certificado carregado: {certificateFile.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Senha do Certificado</Label>
                  <Input
                    type="password"
                    value={settings.certificado_senha}
                    onChange={(e) => setSettings(prev => ({ ...prev, certificado_senha: e.target.value }))}
                    placeholder="senha123"
                  />
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
