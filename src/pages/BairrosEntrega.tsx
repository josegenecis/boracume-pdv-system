
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

const BairrosEntrega = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    delivery_fee: '',
    minimum_order: '',
    delivery_time: '30-45 min'
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchZones();
    }
  }, [user]);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar zonas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as zonas de entrega.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const zoneData = {
        user_id: user?.id,
        name: formData.name.trim(),
        delivery_fee: parseFloat(formData.delivery_fee) || 0,
        minimum_order: parseFloat(formData.minimum_order) || 0,
        delivery_time: formData.delivery_time,
        active: true
      };

      if (editingZone) {
        const { error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', editingZone.id);

        if (error) throw error;

        toast({
          title: 'Zona atualizada',
          description: 'A zona de entrega foi atualizada com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('delivery_zones')
          .insert([zoneData]);

        if (error) throw error;

        toast({
          title: 'Zona criada',
          description: 'A zona de entrega foi criada com sucesso.',
        });
      }

      setFormData({
        name: '',
        delivery_fee: '',
        minimum_order: '',
        delivery_time: '30-45 min'
      });
      setEditingZone(null);
      setShowForm(false);
      fetchZones();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar zona',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      delivery_fee: zone.delivery_fee.toString(),
      minimum_order: zone.minimum_order.toString(),
      delivery_time: zone.delivery_time
    });
    setShowForm(true);
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta zona de entrega?')) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;

      toast({
        title: 'Zona excluída',
        description: 'A zona de entrega foi excluída com sucesso.',
      });

      fetchZones();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir zona',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Zonas de Entrega</h1>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Zona
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingZone ? 'Editar Zona de Entrega' : 'Nova Zona de Entrega'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Zona *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Centro"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_fee">Taxa de Entrega *</Label>
                    <Input
                      id="delivery_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="5.00"
                      value={formData.delivery_fee}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_fee: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimum_order">Pedido Mínimo</Label>
                    <Input
                      id="minimum_order"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="25.00"
                      value={formData.minimum_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, minimum_order: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_time">Tempo de Entrega</Label>
                    <Input
                      id="delivery_time"
                      placeholder="30-45 min"
                      value={formData.delivery_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_time: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingZone ? 'Atualizar' : 'Criar'} Zona
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingZone(null);
                      setFormData({
                        name: '',
                        delivery_fee: '',
                        minimum_order: '',
                        delivery_time: '30-45 min'
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {zones.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhuma zona de entrega cadastrada</p>
              <p className="text-muted-foreground mb-4">
                Comece criando sua primeira zona de entrega.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Zona
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{zone.name}</CardTitle>
                    <Badge variant={zone.active ? "default" : "secondary"}>
                      {zone.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de entrega:</span>
                      <span className="font-medium">{formatCurrency(zone.delivery_fee)}</span>
                    </div>
                    {zone.minimum_order > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pedido mínimo:</span>
                        <span className="font-medium">{formatCurrency(zone.minimum_order)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tempo de entrega:</span>
                      <span className="font-medium">{zone.delivery_time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(zone)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(zone.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BairrosEntrega;
