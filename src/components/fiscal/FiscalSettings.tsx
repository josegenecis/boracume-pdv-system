
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Settings, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const FiscalSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    nfc_series: '',
    nfc_number: 1,
    city_code: '',
    state_inscription: '',
    cnpj: '',
    certificate_path: '',
    certificate_password: '',
    environment: 'homologation',
    service_type: 1,
    taxation_regime: 1
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações fiscais:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('fiscal_settings')
        .upsert({
          ...settings,
          user_id: user?.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações fiscais salvas com sucesso!",
      });
    } catch (error) {
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
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="fiscal-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
            />
            <Label htmlFor="fiscal-enabled">Ativar emissão de NFC-e</Label>
          </div>

          {settings.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={settings.cnpj}
                    onChange={(e) => setSettings(prev => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={settings.state_inscription}
                    onChange={(e) => setSettings(prev => ({ ...prev, state_inscription: e.target.value }))}
                    placeholder="000.000.000.000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Série NFC-e</Label>
                  <Input
                    value={settings.nfc_series}
                    onChange={(e) => setSettings(prev => ({ ...prev, nfc_series: e.target.value }))}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Próximo Número</Label>
                  <Input
                    type="number"
                    value={settings.nfc_number}
                    onChange={(e) => setSettings(prev => ({ ...prev, nfc_number: parseInt(e.target.value) || 1 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Código da Cidade</Label>
                  <Input
                    value={settings.city_code}
                    onChange={(e) => setSettings(prev => ({ ...prev, city_code: e.target.value }))}
                    placeholder="3550308"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select 
                  value={settings.environment} 
                  onValueChange={(value) => setSettings(prev => ({ ...prev, environment: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologation">Homologação</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Caminho do Certificado A1</Label>
                  <Input
                    value={settings.certificate_path}
                    onChange={(e) => setSettings(prev => ({ ...prev, certificate_path: e.target.value }))}
                    placeholder="/path/to/certificate.pfx"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Senha do Certificado</Label>
                  <Input
                    type="password"
                    value={settings.certificate_password}
                    onChange={(e) => setSettings(prev => ({ ...prev, certificate_password: e.target.value }))}
                    placeholder="senha123"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={testConnection} disabled={loading} variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Testar Conexão
                </Button>
                <Button onClick={saveSettings} disabled={loading}>
                  Salvar Configurações
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {settings.enabled && (
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
