
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Scale, Bluetooth, Usb, Wifi, Save, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ScaleIntegrationSettings = () => {
  const [scaleSettings, setScaleSettings] = useState({
    enabled: false,
    connectionType: 'bluetooth',
    deviceName: '',
    unit: 'kg',
    precision: '0.001',
    autoTare: true,
    connected: false
  });

  const [availableDevices] = useState([
    { id: 'scale_001', name: 'Balança Toledo 3400', type: 'bluetooth', status: 'available' },
    { id: 'scale_002', name: 'Balança Filizola BP-15', type: 'usb', status: 'available' },
    { id: 'scale_003', name: 'Balança Urano POP-Z', type: 'wifi', status: 'available' }
  ]);

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('scale_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        setScaleSettings({
          enabled: data.enabled,
          connectionType: data.connection_type,
          deviceName: data.device_name || '',
          unit: data.unit,
          precision: data.precision,
          autoTare: data.auto_tare,
          connected: data.connected
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const handleToggle = (field: string) => {
    setScaleSettings(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setScaleSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const connectToDevice = async (deviceId: string) => {
    try {
      toast({
        title: "Conectando...",
        description: "Tentando conectar com a balança.",
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const device = availableDevices.find(d => d.id === deviceId);
      if (device) {
        setScaleSettings(prev => ({
          ...prev,
          deviceName: device.name,
          connected: true
        }));

        toast({
          title: "Conectado!",
          description: `Conectado com sucesso à ${device.name}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: "Não foi possível conectar com a balança. Verifique se está ligada e próxima.",
        variant: "destructive",
      });
    }
  };

  const testScale = () => {
    if (!scaleSettings.connected) {
      toast({
        title: "Balança não conectada",
        description: "Conecte uma balança antes de fazer o teste.",
        variant: "destructive",
      });
      return;
    }

    const weight = (Math.random() * 5).toFixed(3);
    toast({
      title: "Teste da balança",
      description: `Peso lido: ${weight} ${scaleSettings.unit}`,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: existingData } = await supabase
        .from('scale_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        user_id: user.id,
        enabled: scaleSettings.enabled,
        connection_type: scaleSettings.connectionType,
        device_name: scaleSettings.deviceName,
        unit: scaleSettings.unit,
        precision: scaleSettings.precision,
        auto_tare: scaleSettings.autoTare,
        connected: scaleSettings.connected,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase
          .from('scale_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scale_settings')
          .insert(settingsData);

        if (error) throw error;
      }
      
      toast({
        title: "Configurações salvas!",
        description: "As configurações de integração com balança foram atualizadas.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'bluetooth': return <Bluetooth size={16} />;
      case 'usb': return <Usb size={16} />;
      case 'wifi': return <Wifi size={16} />;
      default: return <Scale size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Conectado</Badge>;
      case 'available':
        return <Badge variant="outline">Disponível</Badge>;
      default:
        return <Badge variant="destructive">Offline</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale size={24} />
            Integração com Balanças
          </CardTitle>
          <CardDescription>
            Configure a integração com balanças de pesagem para produtos vendidos por peso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-scales">Habilitar integração com balanças</Label>
              <p className="text-sm text-muted-foreground">
                Permite conectar balanças via Bluetooth, USB ou Wi-Fi
              </p>
            </div>
            <Switch
              id="enable-scales"
              checked={scaleSettings.enabled}
              onCheckedChange={() => handleToggle('enabled')}
            />
          </div>

          {scaleSettings.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="connection-type">Tipo de Conexão</Label>
                <Select
                  value={scaleSettings.connectionType}
                  onValueChange={(value) => handleSelectChange('connectionType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bluetooth">
                      <div className="flex items-center gap-2">
                        <Bluetooth size={16} />
                        Bluetooth
                      </div>
                    </SelectItem>
                    <SelectItem value="usb">
                      <div className="flex items-center gap-2">
                        <Usb size={16} />
                        USB
                      </div>
                    </SelectItem>
                    <SelectItem value="wifi">
                      <div className="flex items-center gap-2">
                        <Wifi size={16} />
                        Wi-Fi
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade de Medida</Label>
                  <Select
                    value={scaleSettings.unit}
                    onValueChange={(value) => handleSelectChange('unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                      <SelectItem value="g">Gramas (g)</SelectItem>
                      <SelectItem value="lb">Libras (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="precision">Precisão</Label>
                  <Select
                    value={scaleSettings.precision}
                    onValueChange={(value) => handleSelectChange('precision', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (ex: 2 kg)</SelectItem>
                      <SelectItem value="0.1">0.1 (ex: 2.1 kg)</SelectItem>
                      <SelectItem value="0.01">0.01 (ex: 2.15 kg)</SelectItem>
                      <SelectItem value="0.001">0.001 (ex: 2.156 kg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-tare">Tara Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Zerar automaticamente o peso antes de cada pesagem
                  </p>
                </div>
                <Switch
                  id="auto-tare"
                  checked={scaleSettings.autoTare}
                  onCheckedChange={() => handleToggle('autoTare')}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {scaleSettings.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos Disponíveis</CardTitle>
            <CardDescription>
              Balanças detectadas e disponíveis para conexão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {availableDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getConnectionIcon(device.type)}
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        Conexão: {device.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(device.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => connectToDevice(device.id)}
                    >
                      Conectar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {scaleSettings.connected && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900">
                      Balança Conectada: {scaleSettings.deviceName}
                    </p>
                    <p className="text-sm text-green-700">
                      Pronta para uso em produtos por peso
                    </p>
                  </div>
                  <Button variant="outline" onClick={testScale}>
                    <TestTube size={16} className="mr-2" />
                    Testar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
};

export default ScaleIntegrationSettings;
