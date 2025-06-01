
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, MapPin, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  created_at: string;
}

const BairrosEntrega = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({ name: '', delivery_fee: '' });
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
        .order('name', { ascending: true });

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar bairros:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os bairros.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.delivery_fee) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    try {
      const zoneData = {
        user_id: user?.id,
        name: formData.name.trim(),
        delivery_fee: parseFloat(formData.delivery_fee)
      };

      let error;
      if (editingZone) {
        ({ error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', editingZone.id));
      } else {
        ({ error } = await supabase
          .from('delivery_zones')
          .insert([zoneData]));
      }

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Bairro ${editingZone ? 'atualizado' : 'criado'} com sucesso.`,
      });

      setFormData({ name: '', delivery_fee: '' });
      setEditingZone(null);
      setShowDialog(false);
      fetchZones();
    } catch (error: any) {
      console.error('Erro ao salvar bairro:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o bairro.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      delivery_fee: zone.delivery_fee.toString()
    });
    setShowDialog(true);
  };

  const handleDelete = async (zoneId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;

      toast({
        title: "Bairro excluído!",
        description: "O bairro foi excluído com sucesso.",
      });

      fetchZones();
    } catch (error: any) {
      console.error('Erro ao excluir bairro:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o bairro.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingZone(null);
    setFormData({ name: '', delivery_fee: '' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Bairros de Entrega</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando bairros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Bairros de Entrega</h1>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <Plus size={18} className="mr-2" /> Novo Bairro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Editar Bairro' : 'Criar Novo Bairro'}
              </DialogTitle>
              <DialogDescription>
                Configure o nome do bairro e a taxa de entrega.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="zone-name">Nome do Bairro</Label>
                <Input
                  id="zone-name"
                  placeholder="Ex: Centro"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="delivery-fee">Taxa de Entrega (R$)</Label>
                <Input
                  id="delivery-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.delivery_fee}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_fee: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingZone ? 'Atualizar' : 'Criar'} Bairro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {zones.length === 0 ? (
        <div className="text-center py-12">
          <MapPin size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum bairro cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando seu primeiro bairro de entrega.
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus size={18} className="mr-2" /> Adicionar Bairro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin size={18} />
                    {zone.name}
                  </CardTitle>
                </div>
                <CardDescription>
                  Taxa de entrega: {formatCurrency(zone.delivery_fee)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(zone)}
                  >
                    <Edit size={14} className="mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(zone.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BairrosEntrega;
