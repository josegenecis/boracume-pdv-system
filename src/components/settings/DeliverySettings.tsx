
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

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

const DeliverySettings = () => {
  const [settings, setSettings] = useState({
    mapsIntegrationEnabled: false,
    googleMapsApiKey: '',
  });

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [newZone, setNewZone] = useState({ 
    name: '', 
    delivery_fee: '', 
    minimum_order: '',
    delivery_time: '30-45 min'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
      loadDeliveryZones();
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
        setSettings({
          mapsIntegrationEnabled: data.maps_integration_enabled || false,
          googleMapsApiKey: data.google_maps_api_key || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) {
        console.error('Erro ao carregar bairros:', error);
        return;
      }

      setDeliveryZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar bairros:', error);
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

  const addDeliveryZone = async () => {
    if (!newZone.name.trim() || !newZone.delivery_fee || !newZone.minimum_order) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      const zoneData = {
        user_id: user?.id,
        name: newZone.name.trim(),
        delivery_fee: parseFloat(newZone.delivery_fee),
        minimum_order: parseFloat(newZone.minimum_order),
        delivery_time: newZone.delivery_time,
        active: true
      };

      const { data, error } = await supabase
        .from('delivery_zones')
        .insert([zoneData])
        .select()
        .single();

      if (error) throw error;

      setDeliveryZones(prev => [...prev, data]);
      setNewZone({ name: '', delivery_fee: '', minimum_order: '', delivery_time: '30-45 min' });

      toast({
        title: "Bairro adicionado",
        description: `${zoneData.name} foi adicionado à lista de entrega.`,
      });
    } catch (error) {
      console.error('Erro ao adicionar bairro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o bairro. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const removeDeliveryZone = async (id: string) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDeliveryZones(prev => prev.filter(zone => zone.id !== id));

      toast({
        title: "Bairro removido",
        description: "O bairro foi removido da lista de entrega.",
      });
    } catch (error) {
      console.error('Erro ao remover bairro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o bairro. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const toggleZoneStatus = async (zoneId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ active: !currentStatus })
        .eq('id', zoneId);

      if (error) throw error;

      setDeliveryZones(prev => 
        prev.map(zone => 
          zone.id === zoneId 
            ? { ...zone, active: !currentStatus }
            : zone
        )
      );

      toast({
        title: "Status atualizado",
        description: `O bairro foi ${!currentStatus ? 'ativado' : 'desativado'}.`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do bairro.",
        variant: "destructive"
      });
    }
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

      const settingsData = {
        user_id: user.id,
        maps_integration_enabled: settings.mapsIntegrationEnabled,
        google_maps_api_key: settings.googleMapsApiKey,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
            Bairros de Entrega
          </CardTitle>
          <CardDescription>
            Configure os bairros que você atende e as respectivas taxas de entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Nome do Bairro</Label>
              <Input
                id="zone-name"
                placeholder="Ex: Centro"
                value={newZone.name}
                onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Taxa (R$)</Label>
              <Input
                id="delivery-fee"
                type="number"
                step="0.01"
                placeholder="5.00"
                value={newZone.delivery_fee}
                onChange={(e) => setNewZone(prev => ({ ...prev, delivery_fee: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-order">Mínimo (R$)</Label>
              <Input
                id="minimum-order"
                type="number"
                step="0.01"
                placeholder="25.00"
                value={newZone.minimum_order}
                onChange={(e) => setNewZone(prev => ({ ...prev, minimum_order: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-time">Tempo</Label>
              <Input
                id="delivery-time"
                placeholder="30-45 min"
                value={newZone.delivery_time}
                onChange={(e) => setNewZone(prev => ({ ...prev, delivery_time: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={addDeliveryZone} className="w-full">
                <Plus size={16} className="mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Bairros Cadastrados</h4>
            {deliveryZones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum bairro de entrega cadastrado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deliveryZones.map((zone) => (
                  <div key={zone.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{zone.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Taxa: {formatCurrency(zone.delivery_fee)} | 
                        Mín: {formatCurrency(zone.minimum_order)} | 
                        Tempo: {zone.delivery_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={zone.active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleZoneStatus(zone.id, zone.active)}
                      >
                        {zone.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDeliveryZone(zone.id)}
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
