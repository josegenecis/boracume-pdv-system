
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

interface DeliveryZoneSelectorProps {
  deliveryZones?: DeliveryZone[];
  selectedZone: string | null;
  onZoneSelect?: (zoneId: string, deliveryFee: number) => void;
  onZoneChange?: React.Dispatch<React.SetStateAction<string>>;
  onClose?: () => void;
}

const DeliveryZoneSelector: React.FC<DeliveryZoneSelectorProps> = ({
  deliveryZones: propDeliveryZones,
  selectedZone,
  onZoneSelect,
  onZoneChange,
  onClose
}) => {
  const [zones, setZones] = useState<DeliveryZone[]>(propDeliveryZones || []);
  const [loading, setLoading] = useState(!propDeliveryZones);
  const { toast } = useToast();

  useEffect(() => {
    if (!propDeliveryZones) {
      fetchDeliveryZones();
    }
  }, [propDeliveryZones]);

  const fetchDeliveryZones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas de entrega:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar zonas de entrega.",
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

  const handleZoneSelect = (zoneId: string) => {
    if (onZoneChange) {
      onZoneChange(zoneId);
    }
    
    if (onZoneSelect) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        onZoneSelect(zone.id, zone.delivery_fee);
      }
    }
  };

  const handleConfirm = () => {
    if (selectedZone && onZoneSelect) {
      const zone = zones.find(z => z.id === selectedZone);
      if (zone) {
        onZoneSelect(zone.id, zone.delivery_fee);
      }
    }
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2">Carregando zonas de entrega...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin size={20} />
          Selecione sua região
        </CardTitle>
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            Nenhuma zona de entrega disponível no momento.
          </p>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={selectedZone || ''}>
              {zones.map(zone => (
                <div key={zone.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem 
                    value={zone.id} 
                    id={zone.id}
                    onClick={() => handleZoneSelect(zone.id)}
                  />
                  <Label htmlFor={zone.id} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{zone.name}</h4>
                        <p className="text-sm text-gray-600">
                          Tempo: {zone.delivery_time}
                        </p>
                        <p className="text-sm text-gray-600">
                          Pedido mínimo: {formatCurrency(zone.minimum_order)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-primary">
                          {zone.delivery_fee > 0 ? formatCurrency(zone.delivery_fee) : 'Grátis'}
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            {onClose && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirm} 
                  disabled={!selectedZone}
                  className="flex-1"
                >
                  Confirmar região
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryZoneSelector;
