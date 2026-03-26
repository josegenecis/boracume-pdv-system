
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Save, Map, Pencil, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import PolygonAreasEditor, { PolygonAreaDraft, GooglePolygonMap } from '@/components/settings/delivery/PolygonAreasEditor';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

type PricingMode = 'free' | 'fixed' | 'neighborhood' | 'distance_km' | 'distance_bands' | 'radius_km' | 'polygon';

const LeafletAutoResize = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 50);
    const t2 = window.setTimeout(() => map.invalidateSize(), 250);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize();
          })
        : null;
    try {
      const el = map.getContainer();
      ro?.observe(el);
      if ((el as any)?.parentElement) ro?.observe((el as any).parentElement);
    } catch {}
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [map]);
  return null;
};

function MapClickAdder(props: { enabled: boolean; onAdd: (p: {lat: number, lng: number}) => void }) {
  useMapEvents({
    click: (e) => {
      if (!props.enabled) return
      props.onAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

const DeliverySettings = () => {
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [profileAddress, setProfileAddress] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number; formattedAddress?: string } | null>(null);
  const [storeLocLoading, setStoreLocLoading] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>('neighborhood');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<PricingMode>('neighborhood');
  const [fixedPricing, setFixedPricing] = useState({ delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' });
  const [distancePricing, setDistancePricing] = useState({ base_fee: '0', fee_per_km: '0', max_distance_km: '5', minimum_order: '0', delivery_time: '30-45 min' });
  const [distanceBands, setDistanceBands] = useState<Array<{ min_km: string; max_km: string; delivery_fee: string; minimum_order: string; delivery_time: string }>>([
    { min_km: '0', max_km: '5', delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' }
  ]);
  const [radiusPricing, setRadiusPricing] = useState({ radius_km: '5', delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' });
  const [polygonAreas, setPolygonAreas] = useState<PolygonAreaDraft[]>([]);
  const [selectedPolygonAreaId, setSelectedPolygonAreaId] = useState<string | null>(null);
  const [modalities, setModalities] = useState({ delivery: true, pickup: true });
  const [policies, setPolicies] = useState({ 
    validate_with_google: true, 
    accept_outside_coverage: false, 
    outside_delivery_fee: '0',
    free_shipping_min_order: '',
    free_shipping_max_distance: ''
  });
  
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY;
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

  // Carregar biblioteca Places para o autocomplete
  useEffect(() => {
    if (!googleKey) return;
    
    // Aproveitar a função já existente no PolygonAreasEditor ou criar uma nova injeção
    const loadGooglePlaces = async () => {
      try {
        if (!window.google?.maps?.places) {
          // Se o script principal do google maps já foi carregado sem places, 
          // precisamos avisar o usuário que ele precisa recarregar a página 
          // pois a Vercel acabou de atualizar o script base.
          console.log("Aguardando Google Places API...");
        }
      } catch (e) {
        console.error("Erro ao verificar Places API:", e);
      }
    };
    
    loadGooglePlaces();
  }, [googleKey]);

  // Instanciar o Autocomplete
  useEffect(() => {
    if (!window.google?.maps?.places) return;
    
    const inputElement = document.getElementById('store-address-autocomplete') as HTMLInputElement;
    if (!inputElement) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
      types: ['address'],
      componentRestrictions: { country: 'br' } // Restringir buscas ao Brasil
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formattedAddress = place.formatted_address;
        
        setStoreAddress(formattedAddress || '');
        setStoreLocation({
          lat,
          lng,
          formattedAddress: formattedAddress || undefined
        });
      }
    });

    // Cleanup para não vazar instâncias
    return () => {
      if (listener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [googleKey, window.google?.maps?.places]);

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
        if (mode === 'free' || mode === 'fixed' || mode === 'neighborhood' || mode === 'distance_km' || mode === 'distance_bands' || mode === 'radius_km' || mode === 'polygon') {
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
        if (areas?.pricing?.distance_bands?.bands && Array.isArray(areas.pricing.distance_bands.bands)) {
          const bands = areas.pricing.distance_bands.bands;
          setDistanceBands(
            bands.map((b: any) => ({
              min_km: String(b?.min_km ?? '0'),
              max_km: b?.max_km === null || b?.max_km === undefined ? '' : String(b?.max_km),
              delivery_fee: String(b?.delivery_fee ?? '0'),
              minimum_order: String(b?.minimum_order ?? '0'),
              delivery_time: String(b?.delivery_time ?? '30-45 min'),
            }))
          );
        }
        if (areas?.pricing?.radius_km) {
          setRadiusPricing({
            radius_km: String(areas.pricing.radius_km.radius_km ?? '5'),
            delivery_fee: String(areas.pricing.radius_km.delivery_fee ?? '0'),
            minimum_order: String(areas.pricing.radius_km.minimum_order ?? '0'),
            delivery_time: String(areas.pricing.radius_km.delivery_time ?? '30-45 min'),
          });
        }
        if (areas?.pricing?.polygon?.areas && Array.isArray(areas.pricing.polygon.areas)) {
          const areasList = areas.pricing.polygon.areas;
          setPolygonAreas(
            areasList.map((a: any) => ({
              id: String(a?.id || ''),
              name: String(a?.name || 'Área'),
              delivery_fee: String(a?.delivery_fee ?? '0'),
              minimum_order: String(a?.minimum_order ?? '0'),
              delivery_time: String(a?.delivery_time ?? '30-45 min'),
              active: a?.active !== false,
              points: Array.isArray(a?.points) ? a.points.map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) })).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) : []
            }))
          );
          setSelectedPolygonAreaId(areasList[0]?.id ? String(areasList[0].id) : null);
        }
        if (areas?.policies) {
          setPolicies({
            validate_with_google: areas.policies.validate_with_google !== false,
            accept_outside_coverage: areas.policies.accept_outside_coverage === true,
            outside_delivery_fee: String(areas.policies.outside_delivery_fee ?? '0'),
            free_shipping_min_order: areas.policies.free_shipping_min_order ? String(areas.policies.free_shipping_min_order) : '',
            free_shipping_max_distance: areas.policies.free_shipping_max_distance ? String(areas.policies.free_shipping_max_distance) : ''
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

  const handleSave = async (): Promise<boolean> => {
    if (!user) return false;
    
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
        const payload = { id: user.id, address: normalizedAddress, updated_at: new Date().toISOString() } as any;
        const { id, ...updateData } = payload;
        const upd = await supabase.from('profiles').update(updateData).eq('id', id).select('id');
        let profileError = (upd as any).error;
        const updatedRows = (upd as any).data;
        if (!profileError && (!Array.isArray(updatedRows) || updatedRows.length === 0)) {
          const ins = await supabase.from('profiles').insert(payload);
          profileError = (ins as any).error;
        }
        if (profileError) throw profileError;
        setProfileAddress(normalizedAddress);
      }

      const needsStoreLocation = pricingMode === 'distance_km' || pricingMode === 'distance_bands' || pricingMode === 'radius_km' || pricingMode === 'polygon';
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
            const lat = nextStoreLocation?.lat || Number(data?.location?.lat);
            const lng = nextStoreLocation?.lng || Number(data?.location?.lng);
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
          distance_bands: {
            bands: distanceBands.map((b) => ({
              min_km: parseFloat(b.min_km || '0') || 0,
              max_km: b.max_km === '' ? null : (parseFloat(b.max_km || '0') || 0),
              delivery_fee: parseFloat(b.delivery_fee || '0') || 0,
              minimum_order: parseFloat(b.minimum_order || '0') || 0,
              delivery_time: b.delivery_time || '30-45 min',
            }))
          },
          radius_km: {
            radius_km: parseFloat(radiusPricing.radius_km || '0') || 0,
            delivery_fee: parseFloat(radiusPricing.delivery_fee || '0') || 0,
            minimum_order: parseFloat(radiusPricing.minimum_order || '0') || 0,
            delivery_time: radiusPricing.delivery_time || '30-45 min',
          },
          polygon: {
            areas: polygonAreas.map((a) => ({
              id: a.id,
              name: a.name,
              delivery_fee: parseFloat(a.delivery_fee || '0') || 0,
              minimum_order: parseFloat(a.minimum_order || '0') || 0,
              delivery_time: a.delivery_time || '30-45 min',
              active: a.active !== false,
              points: Array.isArray(a.points) ? a.points.map((p) => ({ lat: p.lat, lng: p.lng })) : []
            }))
          }
        },
        policies: {
          validate_with_google: policies.validate_with_google !== false,
          accept_outside_coverage: policies.accept_outside_coverage === true,
          outside_delivery_fee: parseFloat(policies.outside_delivery_fee || '0') || 0,
          free_shipping_min_order: policies.free_shipping_min_order ? parseFloat(policies.free_shipping_min_order) : null,
          free_shipping_max_distance: policies.free_shipping_max_distance ? parseFloat(policies.free_shipping_max_distance) : null
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
      return true;
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
      return false;
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

  const openEditorForMode = (mode: PricingMode) => {
    setPricingMode(mode);
    setEditorMode(mode);
    setEditorOpen(true);
  };

  const handleStoreLocationChange = (loc: { lat: number; lng: number }) => {
    setStoreLocation(loc)
  }

  const renderEditorContent = () => {
    if (editorMode === 'free') {
      return (
        <div className="text-sm text-muted-foreground">
          Frete grátis para todos os pedidos.
        </div>
      );
    }

    if (editorMode === 'fixed') {
      return (
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
      );
    }

    if (editorMode === 'distance_km') {
      return (
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
      );
    }

    if (editorMode === 'distance_bands') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Faixas de entrega</div>
              <div className="text-xs text-muted-foreground">Defina o valor por intervalo de km</div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDistanceBands((prev) => [
                  ...prev,
                  { min_km: '', max_km: '', delivery_fee: '0', minimum_order: '0', delivery_time: '30-45 min' }
                ])
              }
            >
              <Plus size={16} className="mr-2" />
              Adicionar faixa
            </Button>
          </div>

          <div className="space-y-3">
            {distanceBands.map((band, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-2">
                    <Label>De (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={band.min_km}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDistanceBands((prev) => prev.map((b, i) => (i === idx ? { ...b, min_km: v } : b)));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Até (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="(vazio = sem limite)"
                      value={band.max_km}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDistanceBands((prev) => prev.map((b, i) => (i === idx ? { ...b, max_km: v } : b)));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Taxa (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={band.delivery_fee}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDistanceBands((prev) => prev.map((b, i) => (i === idx ? { ...b, delivery_fee: v } : b)));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mínimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={band.minimum_order}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDistanceBands((prev) => prev.map((b, i) => (i === idx ? { ...b, minimum_order: v } : b)));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo</Label>
                    <Input
                      value={band.delivery_time}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDistanceBands((prev) => prev.map((b, i) => (i === idx ? { ...b, delivery_time: v } : b)));
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDistanceBands((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={distanceBands.length <= 1}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (editorMode === 'radius_km') {
      const radiusKm = Number(String(radiusPricing.radius_km || '0').replace(',', '.'));
      const radiusMeters = Number.isFinite(radiusKm) ? Math.max(0, radiusKm) * 1000 : 0;
      return (
        <div className="space-y-4">
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
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-8"
                  value={radiusPricing.delivery_fee}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, delivery_fee: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pedido mínimo (R$)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-8"
                  value={radiusPricing.minimum_order}
                  onChange={(e) => setRadiusPricing(prev => ({ ...prev, minimum_order: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tempo estimado</Label>
              <Input
                value={radiusPricing.delivery_time}
                onChange={(e) => setRadiusPricing(prev => ({ ...prev, delivery_time: e.target.value }))}
              />
            </div>
          </div>

          {storeLocation ? (
            <div className="border rounded-xl overflow-hidden mt-4 shadow-sm relative">
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border text-xs font-medium text-boracume-dark-green">
                Prévia do raio
              </div>
              <div className="h-[500px] w-full">
                {googleKey && window.google?.maps ? (
                  <GooglePolygonMap
                    center={{ lat: storeLocation.lat, lng: storeLocation.lng }}
                    enabled={false}
                    points={[]}
                    onAddPoint={() => {}}
                    storeLocation={{ lat: storeLocation.lat, lng: storeLocation.lng }}
                    radiusMeters={radiusMeters}
                  />
                ) : (
                  <MapContainer
                    center={[storeLocation.lat, storeLocation.lng]}
                    zoom={radiusKm >= 8 ? 12 : radiusKm >= 4 ? 13 : 14}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LeafletAutoResize />
                    <Circle
                      center={[storeLocation.lat, storeLocation.lng]}
                      radius={radiusMeters || 0}
                      pathOptions={{ color: '#F26522', fillColor: '#F26522', fillOpacity: 0.15, weight: 2 }}
                    />
                    <CircleMarker center={[storeLocation.lat, storeLocation.lng]} radius={6} pathOptions={{ color: '#003A2B', fillColor: '#003A2B', fillOpacity: 1 }} />
                  </MapContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Defina a localização do restaurante para visualizar o raio no mapa.
            </div>
          )}
        </div>
      );
    }

    if (editorMode === 'polygon') {
      return (
        <PolygonAreasEditor
          storeLocation={storeLocation ? { lat: storeLocation.lat, lng: storeLocation.lng } : null}
          onStoreLocationChange={handleStoreLocationChange}
          areas={polygonAreas}
          setAreas={setPolygonAreas}
          selectedId={selectedPolygonAreaId}
          setSelectedId={setSelectedPolygonAreaId}
        />
      );
    }

    return (
      <div className="space-y-4">
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
      </div>
    );
  };

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
          <div className="p-3 border rounded-lg space-y-4 bg-gray-50/50">
            <div className="space-y-2">
              <div className="text-sm font-medium">Endereço do restaurante</div>
              <div className="flex gap-2 relative">
                <Input
                  id="store-address-autocomplete"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade, UF"
                  className="bg-white"
                />
                <Button variant="outline" onClick={geocodeStoreAddress} disabled={storeLocLoading} className="shrink-0 bg-white">
                  {storeLocLoading ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Para frete por KM/raio, use um endereço completo e clique em Buscar.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Localização exata (Pino no Mapa)</div>
                {storeLocation && (
                  <Badge variant="outline" className="bg-boracume-green/10 text-boracume-dark-green border-0">
                    Definido
                  </Badge>
                )}
              </div>
              
              <div className="h-[300px] border rounded-lg overflow-hidden relative">
                {!storeLocation && (
                  <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                    <MapPin className="text-gray-400 mb-2 h-8 w-8" />
                    <p className="text-sm font-medium text-gray-700">Localização não definida</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      Busque um endereço acima ou clique no botão abaixo para definir manualmente no mapa.
                    </p>
                  </div>
                )}
                
                {googleKey && window.google?.maps ? (
                  <div className="h-full w-full">
                    <GooglePolygonMap
                      center={storeLocation ? { lat: storeLocation.lat, lng: storeLocation.lng } : { lat: -15.793889, lng: -47.882778 }}
                      enabled={false}
                      points={[]}
                      onAddPoint={() => {}}
                      storeLocation={storeLocation ? { lat: storeLocation.lat, lng: storeLocation.lng } : null}
                      onStoreLocationChange={(loc) => setStoreLocation({ lat: loc.lat, lng: loc.lng, formattedAddress: storeAddress })}
                    />
                  </div>
                ) : (
                  <MapContainer
                    center={storeLocation ? [storeLocation.lat, storeLocation.lng] : [-15.793889, -47.882778]}
                    zoom={storeLocation ? 16 : 4}
                    style={{ height: '100%', width: '100%' }}
                    key={`store-map-${storeLocation?.lat || 0}-${storeLocation?.lng || 0}`}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LeafletAutoResize />
                    {storeLocation && (
                      <CircleMarker 
                        center={[storeLocation.lat, storeLocation.lng]} 
                        radius={8} 
                        pathOptions={{ color: '#F26522', fillColor: '#F26522', fillOpacity: 1, weight: 2 }} 
                      />
                    )}
                    {/* Evento para mover o pino clicando no mapa */}
                    <MapClickAdder 
                      enabled={true} 
                      onAdd={(p) => setStoreLocation({ lat: p.lat, lng: p.lng, formattedAddress: storeAddress })} 
                    />
                  </MapContainer>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Você pode clicar em qualquer lugar do mapa acima para ajustar o pino exato do seu restaurante.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Validação com Google Maps</div>
                <div className="text-xs text-muted-foreground">Verifica endereço e cobertura automaticamente</div>
              </div>
              <Switch
                checked={policies.validate_with_google}
                onCheckedChange={(v) => setPolicies((prev) => ({ ...prev, validate_with_google: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Aceitar fora da cobertura</div>
                <div className="text-xs text-muted-foreground">Permite finalizar mesmo fora da área</div>
              </div>
              <Switch
                checked={policies.accept_outside_coverage}
                onCheckedChange={(v) => setPolicies((prev) => ({ ...prev, accept_outside_coverage: v }))}
              />
            </div>
          </div>

          {policies.accept_outside_coverage && (
            <div className="p-3 border rounded-lg space-y-2">
              <div className="text-sm font-medium">Taxa fora da cobertura (R$)</div>
              <Input
                type="number"
                step="0.01"
                value={policies.outside_delivery_fee}
                onChange={(e) => setPolicies((prev) => ({ ...prev, outside_delivery_fee: e.target.value }))}
              />
            </div>
          )}

          <div className="p-4 border rounded-xl bg-boracume-light/30 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-boracume-dark-green">
                <MapPin size={16} /> Promoção de Frete Grátis
              </h3>
              <p className="text-xs text-muted-foreground">
                Ofereça frete grátis para pedidos acima de um valor específico, limitado a uma distância máxima.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor mínimo do pedido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 50.00 (vazio = desativado)"
                  value={policies.free_shipping_min_order}
                  onChange={(e) => setPolicies((prev) => ({ ...prev, free_shipping_min_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Distância máxima (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 5 (vazio = sem limite)"
                  value={policies.free_shipping_max_distance}
                  onChange={(e) => setPolicies((prev) => ({ ...prev, free_shipping_max_distance: e.target.value }))}
                />
              </div>
            </div>
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
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        openEditorForMode(c.id);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
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
          <p className="text-xs text-muted-foreground">
            Clique em Editar para configurar o modo selecionado.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="right" className={`w-full ${editorMode === 'polygon' || editorMode === 'radius_km' ? 'sm:max-w-[100vw] md:max-w-[90vw] lg:max-w-[1200px] xl:max-w-[1400px]' : 'sm:max-w-xl'} overflow-auto`}>
          <SheetHeader className="mb-4">
            <SheetTitle>Editar: {pricingCards.find((c) => c.id === editorMode)?.title || 'Delivery'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
            <div className="flex-1 overflow-auto">
              {renderEditorContent()}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) setEditorOpen(false);
                }}
                disabled={loading}
              >
                <Save size={16} className="mr-2" />
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DeliverySettings;
