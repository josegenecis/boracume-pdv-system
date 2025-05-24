import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Save, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryArea {
  id: string;
  name: string;
  fee: number;
}

const DeliverySettings = () => {
  const [settings, setSettings] = useState({
    mapsIntegrationEnabled: false,
    googleMapsApiKey: '',
    deliveryAreas: [] as DeliveryArea[]
  });

  const [newArea, setNewArea] = useState({ name: '', fee: '' });
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
        .from('delivery_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        // Safely parse the delivery_areas from JSON
        let deliveryAreas: DeliveryArea[] = [];
        if (data.delivery_areas) {
          try {
            // Properly handle the Json type conversion
            if (Array.isArray(data.delivery_areas)) {
              deliveryAreas = data.delivery_areas as unknown as DeliveryArea[];
            } else if (typeof data.delivery_areas === 'string') {
              deliveryAreas = JSON.parse(data.delivery_areas);
            }
          } catch (e) {
            console.error('Error parsing delivery areas:', e);
            deliveryAreas = [];
          }
        }

        setSettings({
          mapsIntegrationEnabled: data.maps_integration_enabled || false,
          googleMapsApiKey: data.google_maps_api_key || '',
          deliveryAreas: deliveryAreas
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const handleToggle = (field: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addDeliveryArea = () => {
    if (!newArea.name.trim() || !newArea.fee) {
      toast({
        title: "Dados incompletos",
        description: "Preencha o nome do bairro e a taxa de entrega.",
        variant: "destructive"
      });
      return;
    }

    const area: DeliveryArea = {
      id: Date.now().toString(),
      name: newArea.name.trim(),
      fee: parseFloat(newArea.fee)
    };

    setSettings(prev => ({
      ...prev,
      deliveryAreas: [...prev.deliveryAreas, area]
    }));

    setNewArea({ name: '', fee: '' });

    toast({
      title: "Área adicionada",
      description: `${area.name} foi adicionado à lista de entrega.`,
    });
  };

  const removeDeliveryArea = (id: string) => {
    setSettings(prev => ({
      ...prev,
      deliveryAreas: prev.deliveryAreas.filter(area => area.id !== id)
    }));

    toast({
      title: "Área removida",
      description: "A área de entrega foi removida da lista.",
    });
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: existingData } = await supabase
        .from('delivery_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Convert DeliveryArea[] to Json format for Supabase
      const settingsData = {
        user_id: user.id,
        maps_integration_enabled: settings.mapsIntegrationEnabled,
        google_maps_api_key: settings.googleMapsApiKey,
        delivery_areas: JSON.stringify(settings.deliveryAreas),
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase
          .from('delivery_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('delivery_settings')
          .insert(settingsData);

        if (error) throw error;
      }
      
      toast({
        title: "Configurações salvas!",
        description: "As configurações de delivery foram atualizadas com sucesso.",
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map size={24} />
            Integração com Mapas
          </CardTitle>
          <CardDescription>
            Configure a integração com Google Maps para cálculo automático de distância
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maps-integration">Habilitar Google Maps</Label>
              <p className="text-sm text-muted-foreground">
                Permite cálculo automático de distância e tempo de entrega
              </p>
            </div>
            <Switch
              id="maps-integration"
              checked={settings.mapsIntegrationEnabled}
              onCheckedChange={() => handleToggle('mapsIntegrationEnabled')}
            />
          </div>

          {settings.mapsIntegrationEnabled && (
            <div className="space-y-2">
              <Label htmlFor="google-maps-key">Chave da API do Google Maps</Label>
              <Input
                id="google-maps-key"
                type="password"
                placeholder="Insira sua chave da API do Google Maps"
                value={settings.googleMapsApiKey}
                onChange={(e) => handleInputChange('googleMapsApiKey', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Obtenha sua chave gratuita no Google Cloud Console
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin size={24} />
            Áreas de Entrega
          </CardTitle>
          <CardDescription>
            Configure os bairros que você atende e as respectivas taxas de entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Nome do Bairro</Label>
              <Input
                id="area-name"
                placeholder="Ex: Centro"
                value={newArea.name}
                onChange={(e) => setNewArea(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Taxa de Entrega (R$)</Label>
              <Input
                id="delivery-fee"
                type="number"
                step="0.01"
                placeholder="Ex: 5.00"
                value={newArea.fee}
                onChange={(e) => setNewArea(prev => ({ ...prev, fee: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={addDeliveryArea} className="w-full">
                <Plus size={16} className="mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Áreas Cadastradas</h4>
            {settings.deliveryAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma área de entrega cadastrada ainda.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {settings.deliveryAreas.map((area) => (
                  <div key={area.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{area.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Taxa: R$ {area.fee.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Ativo</Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDeliveryArea(area.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
};

export default DeliverySettings;
