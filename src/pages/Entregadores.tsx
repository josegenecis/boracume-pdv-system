
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users, Phone, Bike } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate?: string;
  status: string;
  created_at: string;
}

const Entregadores = () => {
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<DeliveryPerson | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle_type: 'motorcycle',
    vehicle_plate: ''
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDeliveryPersonnel();
    }
  }, [user]);

  const fetchDeliveryPersonnel = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_personnel')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setDeliveryPersonnel(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar entregadores:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os entregadores.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const personData = {
        user_id: user?.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        vehicle_type: formData.vehicle_type,
        vehicle_plate: formData.vehicle_plate.trim() || null,
        status: 'available'
      };

      if (editingPerson) {
        const { error } = await supabase
          .from('delivery_personnel')
          .update(personData)
          .eq('id', editingPerson.id);

        if (error) throw error;

        toast({
          title: 'Entregador atualizado',
          description: 'O entregador foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('delivery_personnel')
          .insert([personData]);

        if (error) throw error;

        toast({
          title: 'Entregador cadastrado',
          description: 'O entregador foi cadastrado com sucesso.',
        });
      }

      setFormData({
        name: '',
        phone: '',
        vehicle_type: 'motorcycle',
        vehicle_plate: ''
      });
      setEditingPerson(null);
      setShowForm(false);
      fetchDeliveryPersonnel();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar entregador',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (person: DeliveryPerson) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      phone: person.phone,
      vehicle_type: person.vehicle_type,
      vehicle_plate: person.vehicle_plate || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (personId: string) => {
    if (!confirm('Tem certeza que deseja excluir este entregador?')) return;

    try {
      const { error } = await supabase
        .from('delivery_personnel')
        .delete()
        .eq('id', personId);

      if (error) throw error;

      toast({
        title: 'Entregador excluído',
        description: 'O entregador foi excluído com sucesso.',
      });

      fetchDeliveryPersonnel();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir entregador',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'busy': return 'Ocupado';
      case 'offline': return 'Offline';
      default: return status;
    }
  };

  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType) {
      case 'motorcycle': return <Bike className="h-4 w-4" />;
      case 'bicycle': return <Bike className="h-4 w-4" />;
      case 'car': return <Users className="h-4 w-4" />;
      default: return <Bike className="h-4 w-4" />;
    }
  };

  const getVehicleText = (vehicleType: string) => {
    switch (vehicleType) {
      case 'motorcycle': return 'Moto';
      case 'bicycle': return 'Bicicleta';
      case 'car': return 'Carro';
      default: return vehicleType;
    }
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
            <Users className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Entregadores</h1>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Entregador
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingPerson ? 'Editar Entregador' : 'Novo Entregador'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      placeholder="Nome do entregador"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">Tipo de Veículo *</Label>
                    <Select
                      value={formData.vehicle_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, vehicle_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorcycle">Moto</SelectItem>
                        <SelectItem value="bicycle">Bicicleta</SelectItem>
                        <SelectItem value="car">Carro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_plate">Placa do Veículo</Label>
                    <Input
                      id="vehicle_plate"
                      placeholder="ABC-1234"
                      value={formData.vehicle_plate}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicle_plate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingPerson ? 'Atualizar' : 'Cadastrar'} Entregador
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingPerson(null);
                      setFormData({
                        name: '',
                        phone: '',
                        vehicle_type: 'motorcycle',
                        vehicle_plate: ''
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

        {deliveryPersonnel.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum entregador cadastrado</p>
              <p className="text-muted-foreground mb-4">
                Comece cadastrando seu primeiro entregador.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Entregador
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveryPersonnel.map((person) => (
              <Card key={person.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{person.name}</CardTitle>
                    <Badge className={getStatusColor(person.status)}>
                      {getStatusText(person.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{person.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getVehicleIcon(person.vehicle_type)}
                      <span className="text-sm">
                        {getVehicleText(person.vehicle_type)}
                        {person.vehicle_plate && ` - ${person.vehicle_plate}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(person)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(person.id)}
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

export default Entregadores;
