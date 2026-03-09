
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Save, Map, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

type PricingMode = 'free' | 'fixed' | 'neighborhood' | 'distance_km' | 'radius_km' | 'polygon';

const DeliverySettings = () => {
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [profileAddress, setProfileAddress] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number; formattedAddress?: string } | null>(null);
  const [storeLocLoading, setStoreLocLoading] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>('neighborhood');
  const [fixedPricing, setFixedPricing] = useState({ delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' });
  const [distancePricing, setDistancePricing] = useState({ base_fee: '0', fee_per_km: '0', max_distance_km: '5', minimum_order: '0', delivery_time: '30-45 min' });
  const [radiusPricing, setRadiusPricing] = useState({ radius_km: '5', delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' });
  const [modalities, setModalities] = useState({ delivery: true, pickup: true });
  const [newZone, setNewZone] = useState({ name: '', delivery_fee: '', minimum_order: '', delivery_time: '30-45 min' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
      loadDeliveryZones();
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('address')
        .eq('id', user?.id)
        .maybeSingle();
      if (error) return;
      const addr = String((data as any)?.address || '');
      setProfileAddress(addr);
      setStoreAddress((prev) => (prev ? prev : addr));
    } catch {}
  };

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
        const areas = (data as any)?.delivery_areas;
        const loc = (areas as any)?.store_location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          setStoreLocation({ lat: Number(loc.lat), lng: Number(loc.lng), formattedAddress: String(loc.formattedAddress || '') || undefined });
        }
        const mode = String(areas?.pricing?.mode || '');
        if (mode === 'free' || mode === 'fixed' || mode === 'neighborhood' || mode === 'distance_km' || mode === 'radius_km' || mode === 'polygon') {
          setPricingMode(mode as PricingMode);
        }
        if (areas?.pricing?.fixed) {
          setFixedPricing({
            delivery_fee: String(areas.pricing.fixed.delivery_fee ?? '0'),
            minimum_order: String(areas.pricing.fixed.minimum_order ?? '0'),
            delivery_time: String(areas.pricing.fixed.delivery_time ?? '30-45 min'),
          });
        }
        if (areas?.pricing?.distance_km) {
          setDistancePricing({
            base_fee: String(areas.pricing.distance_km.base_fee ?? '0'),
            fee_per_km: String(areas.pricing.distance_km.fee_per_km ?? '0'),
            max_distance_km: String(areas.pricing.distance_km.max_distance_km ?? '5'),
            minimum_order: String(areas.pricing.distance_km.minimum_order ?? '0'),
            delivery_time: String(areas.pricing.distance_km.delivery_time ?? '30-45 min'),
          });
        }
        if (areas?.pricing?.radius_km) {
          setRadiusPricing({
            radius_km: String(areas.pricing.radius_km.radius_km ?? '5'),
            delivery_fee: String(areas.pricing.radius_km.delivery_fee ?? '0'),
            minimum_order: String(areas.pricing.radius_km.minimum_order ?? '0'),
            delivery_time: String(areas.pricing.radius_km.delivery_time ?? '30-45 min'),
          });
        }
        if (areas?.modalities) {
          setModalities({
            delivery: areas.modalities.delivery !== false,
            pickup: areas.modalities.pickup !== false,
          });
        }
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

  const geocodeStoreAddress = async () => {
    const addr = String(storeAddress || '').trim();
    if (!addr) {
      toast({ title: 'Endereço não informado', description: 'Preencha o endereço do restaurante.', variant: 'destructive' });
      return;
    }
    setStoreLocLoading(true);
    try {
      const { data, status } = await invokeEdgeFunction('maps-geocode', { address: addr, userId: user?.id });
      if (!data?.ok) {
        throw new Error(String(data?.error || `Falha ao geocodificar (HTTP ${status})`));
      }
      const lat = Number(data?.location?.lat);
      const lng = Number(data?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas inválidas retornadas pelo mapa');
      setStoreLocation({ lat, lng, formattedAddress: String(data?.formattedAddress || '').trim() || undefined });
      toast({ title: 'Localização definida', description: 'Coordenadas do restaurante salvas para cálculo de frete.' });
    } catch (e: any) {
      toast({ title: 'Erro ao localizar', description: e?.message || 'Não foi possível localizar o endereço.', variant: 'destructive' });
    } finally {
      setStoreLocLoading(false);
    }
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
      const payload = {
        name: newZone.name.trim(),
        delivery_fee: parseFloat(newZone.delivery_fee),
        minimum_order: parseFloat(newZone.minimum_order),
        delivery_time: newZone.delivery_time,
        active: true,
        coverage_area: { type: 'neighborhood' }
      };

      if (editingZone) {
        const { data, error } = await supabase
          .from('delivery_zones')
          .update(payload)
          .eq('id', editingZone.id)
          .select()
          .single();

        if (error) throw error;

        setDeliveryZones(prev => prev.map(z => (z.id === editingZone.id ? data : z)));
        setEditingZone(null);
        setNewZone({ name: '', delivery_fee: '', minimum_order: '', delivery_time: '30-45 min' });
        toast({
          title: "Bairro atualizado",
          description: `${payload.name} foi atualizado.`,
        });
      } else {
        const zoneData = {
          user_id: user?.id,
          ...payload
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
          description: `${payload.name} foi adicionado à lista de entrega.`,
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar bairro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o bairro. Verifique se sua base tem os campos de área de entrega habilitados.",
        variant: "destructive"
      });
    }
  };

  const startEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setNewZone({
      name: zone.name,
      delivery_fee: String(zone.delivery_fee ?? ''),
      minimum_order: String(zone.minimum_order ?? ''),
      delivery_time: zone.delivery_time || '30-45 min'
    });
  };

  const cancelEditZone = () => {
    setEditingZone(null);
    setNewZone({ name: '', delivery_fee: '', minimum_order: '', delivery_time: '30-45 min' });
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

      const oldAddress = String(profileAddress || '').trim();
      const normalizedAddress = String(storeAddress || '').trim();
      if (normalizedAddress && normalizedAddress !== oldAddress) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: user.id, address: normalizedAddress, updated_at: new Date().toISOString() } as any);
        if (profileError) throw profileError;
        setProfileAddress(normalizedAddress);
      }

      const needsStoreLocation = pricingMode === 'distance_km' || pricingMode === 'radius_km' || pricingMode === 'polygon';
      let nextStoreLocation = storeLocation;
      if (needsStoreLocation) {
        if (!normalizedAddress) {
          throw new Error('Informe o endereço do restaurante para calcular por km/raio.');
        }
        if (!nextStoreLocation || normalizedAddress !== oldAddress) {
          setStoreLocLoading(true);
          try {
            const { data, status } = await invokeEdgeFunction('maps-geocode', { address: normalizedAddress, userId: user.id });
            if (!data?.ok) {
              throw new Error(String(data?.error || `Falha ao geocodificar (HTTP ${status})`));
            }
            const lat = Number(data?.location?.lat);
            const lng = Number(data?.location?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas inválidas retornadas pelo mapa');
            nextStoreLocation = { lat, lng, formattedAddress: String(data?.formattedAddress || '').trim() || undefined };
            setStoreLocation(nextStoreLocation);
          } finally {
            setStoreLocLoading(false);
          }
        }
      }

      const deliveryAreas = {
        store_location: nextStoreLocation ? { lat: nextStoreLocation.lat, lng: nextStoreLocation.lng, formattedAddress: nextStoreLocation.formattedAddress || null } : null,
        pricing: {
          mode: pricingMode,
          fixed: {
            delivery_fee: parseFloat(fixedPricing.delivery_fee || '0') || 0,
            minimum_order: parseFloat(fixedPricing.minimum_order || '0') || 0,
            delivery_time: fixedPricing.delivery_time || '30-45 min',
          },
          distance_km: {
            base_fee: parseFloat(distancePricing.base_fee || '0') || 0,
            fee_per_km: parseFloat(distancePricing.fee_per_km || '0') || 0,
            max_distance_km: parseFloat(distancePricing.max_distance_km || '0') || 0,
            minimum_order: parseFloat(distancePricing.minimum_order || '0') || 0,
            delivery_time: distancePricing.delivery_time || '30-45 min',
          },
          radius_km: {
            radius_km: parseFloat(radiusPricing.radius_km || '0') || 0,
            delivery_fee: parseFloat(radiusPricing.delivery_fee || '0') || 0,
            minimum_order: parseFloat(radiusPricing.minimum_order || '0') || 0,
            delivery_time: radiusPricing.delivery_time || '30-45 min',
          }
        },
        modalities: {
          delivery: !!modalities.delivery,
          pickup: !!modalities.pickup,
        }
      };

      const settingsData = {
        user_id: user.id,
        delivery_areas: deliveryAreas,
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

  const pricingCards = useMemo(() => {
    return [
      { id: 'free', title: 'Sem preço', subtitle: 'Ofereça frete grátis aos seus clientes' },
      { id: 'fixed', title: 'Preço fixo', subtitle: 'O mesmo preço de envio se aplica a todos os pedidos' },
      { id: 'neighborhood', title: 'Bairro de destino', subtitle: 'O preço varia de acordo com o bairro' },
      { id: 'distance_km', title: 'Distância percorrida', subtitle: 'O cliente paga de acordo com os quilômetros' },
      { id: 'radius_km', title: 'Raio de entrega', subtitle: 'O preço varia pelo raio (km) do restaurante' },
      { id: 'polygon', title: 'Áreas personalizadas', subtitle: 'Defina áreas no mapa para cálculo do preço' },
    ] as const;
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map size={24} />
            Mapas
          </CardTitle>
          <CardDescription>
            Usado para calcular frete por KM e por raio automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Basta informar o endereço do restaurante abaixo e escolher o tipo de frete. A configuração de mapas é gerenciada pelo sistema.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin size={24} />
            Configurar preços e cobertura de envio
          </CardTitle>
          <CardDescription>
            Defina como calcular frete e quais modalidades você atende
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 border rounded-lg space-y-2">
            <div className="text-sm font-medium">Endereço do restaurante</div>
            <Input
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade, UF"
            />
            <p className="text-xs text-muted-foreground">
              Para frete por KM/raio, use um endereço completo.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="min-w-0">
              <div className="text-sm font-medium">Localização do restaurante</div>
              {storeLocation ? (
                <div className="text-sm text-muted-foreground truncate">
                  {storeLocation.formattedAddress ? `${storeLocation.formattedAddress} • ` : ''}
                  {storeLocation.lat.toFixed(6)}, {storeLocation.lng.toFixed(6)}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground truncate">Não definida</div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={geocodeStoreAddress} disabled={storeLocLoading}>
              {storeLocLoading ? 'Localizando...' : 'Definir pelo endereço'}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Selecione o preço e a cobertura de envio</div>
            <div className="space-y-2">
              {pricingCards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPricingMode(c.id)}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${pricingMode === c.id ? 'border-boracume-orange bg-boracume-orange/5' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{c.title}</div>
                    {pricingMode === c.id && <Badge>Selecionado</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{c.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Delivery</div>
                <div className="text-xs text-muted-foreground">Atender pedidos com entrega</div>
              </div>
              <Switch checked={modalities.delivery} onCheckedChange={(v) => setModalities(prev => ({ ...prev, delivery: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Retirada</div>
                <div className="text-xs text-muted-foreground">Cliente retira no balcão</div>
              </div>
              <Switch checked={modalities.pickup} onCheckedChange={(v) => setModalities(prev => ({ ...prev, pickup: v }))} />
            </div>
          </div>

          {pricingMode === 'fixed' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Taxa fixa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fixedPricing.delivery_fee}
                  onChange={(e) => setFixedPricing(prev => ({ ...prev, delivery_fee: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fixedPricing.minimum_order}
                  onChange={(e) => setFixedPricing(prev => ({ ...prev, minimum_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempo estimado</Label>
                <Input
                  value={fixedPricing.delivery_time}
                  onChange={(e) => setFixedPricing(prev => ({ ...prev, delivery_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {pricingMode === 'distance_km' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Taxa base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={distancePricing.base_fee}
                  onChange={(e) => setDistancePricing(prev => ({ ...prev, base_fee: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço por km (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={distancePricing.fee_per_km}
                  onChange={(e) => setDistancePricing(prev => ({ ...prev, fee_per_km: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Distância máxima (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={distancePricing.max_distance_km}
                  onChange={(e) => setDistancePricing(prev => ({ ...prev, max_distance_km: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={distancePricing.minimum_order}
                  onChange={(e) => setDistancePricing(prev => ({ ...prev, minimum_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempo estimado</Label>
                <Input
                  value={distancePricing.delivery_time}
                  onChange={(e) => setDistancePricing(prev => ({ ...prev, delivery_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {pricingMode === 'radius_km' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Raio máximo (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={radiusPricing.radius_km}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, radius_km: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={radiusPricing.delivery_fee}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, delivery_fee: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={radiusPricing.minimum_order}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, minimum_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempo estimado</Label>
                <Input
                  value={radiusPricing.delivery_time}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, delivery_time: e.target.value }))}
                />
              </div>
            </div>
          )}

          {pricingMode === 'neighborhood' && (
            <>
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
                  <div className="flex gap-2">
                    <Button onClick={addDeliveryZone} className="w-full">
                      {editingZone ? <Save size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
                      {editingZone ? 'Atualizar' : 'Adicionar'}
                    </Button>
                    {editingZone && (
                      <Button type="button" variant="outline" onClick={cancelEditZone} className="w-full">
                        <X size={16} className="mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                  </Button>
                </div>
              </div>

          <div className="space-y-3">
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
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditZone(zone)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
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
            </>
          )}
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
