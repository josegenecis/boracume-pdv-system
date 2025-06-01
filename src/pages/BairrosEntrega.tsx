
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
}

const BairrosEntrega = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [newZone, setNewZone] = useState({ name: '', delivery_fee: 0 });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchZones();
    }
  }, [user]);

  const fetchZones = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      
      if (error) throw error;
      setZones(data || []);
    } catch (error: any) {
      console.warn('Delivery zones table not ready yet:', error);
      setZones([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!user || !newZone.name.trim()) return;

    try {
      setIsLoading(true);
      
      if (editingZone) {
        const { error } = await (supabase as any)
          .from('delivery_zones')
          .update({
            name: newZone.name,
            delivery_fee: newZone.delivery_fee,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingZone.id);
        
        if (error) throw error;
        
        toast({
          title: 'Bairro atualizado',
          description: 'As informações do bairro foram atualizadas com sucesso.',
        });
      } else {
        const { error } = await (supabase as any)
          .from('delivery_zones')
          .insert({
            user_id: user.id,
            name: newZone.name,
            delivery_fee: newZone.delivery_fee
          });
        
        if (error) throw error;
        
        toast({
          title: 'Bairro adicionado',
          description: 'O novo bairro foi adicionado com sucesso.',
        });
      }
      
      setNewZone({ name: '', delivery_fee: 0 });
      setEditingZone(null);
      fetchZones();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar bairro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setNewZone({ name: zone.name, delivery_fee: zone.delivery_fee });
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Tem certeza que deseja excluir este bairro?')) return;

    try {
      setIsLoading(true);
      const { error } = await (supabase as any)
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);
      
      if (error) throw error;
      
      toast({
        title: 'Bairro excluído',
        description: 'O bairro foi excluído com sucesso.',
      });
      
      fetchZones();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir bairro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <MapPin className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Bairros de Entrega</h1>
        </div>

        {/* Formulário para adicionar/editar bairro */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingZone ? 'Editar Bairro' : 'Adicionar Novo Bairro'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Bairro</Label>
                <Input
                  id="name"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="Ex: Centro, Vila Nova..."
                />
              </div>
              <div>
                <Label htmlFor="fee">Taxa de Entrega (R$)</Label>
                <Input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newZone.delivery_fee}
                  onChange={(e) => setNewZone({ ...newZone, delivery_fee: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleSaveZone} 
                disabled={isLoading || !newZone.name.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {editingZone ? 'Atualizar' : 'Adicionar'} Bairro
              </Button>
              {editingZone && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditingZone(null);
                    setNewZone({ name: '', delivery_fee: 0 });
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de bairros */}
        <Card>
          <CardHeader>
            <CardTitle>Bairros Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {zones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum bairro cadastrado ainda.</p>
                <p className="text-sm">Adicione bairros para organizar suas entregas.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Bairro</TableHead>
                    <TableHead>Taxa de Entrega</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell>{formatCurrency(zone.delivery_fee)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditZone(zone)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteZone(zone.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BairrosEntrega;
