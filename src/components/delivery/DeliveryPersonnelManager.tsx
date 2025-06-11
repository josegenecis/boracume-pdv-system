
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin, Phone, Car, Bike, Motorcycle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate?: string;
  status: 'available' | 'busy' | 'offline';
  created_at: string;
}

const DeliveryPersonnelManager = () => {
  const [personnel, setPersonnel] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<DeliveryPerson | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle_type: 'motorcycle',
    vehicle_plate: '',
    status: 'available' as const
  });

  useEffect(() => {
    if (user) {
      fetchPersonnel();
    }
  }, [user]);

  const fetchPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_personnel')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonnel(data || []);
    } catch (error) {
      console.error('Erro ao carregar entregadores:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os entregadores.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const personnelData = {
        ...formData,
        user_id: user?.id
      };

      if (editingPerson) {
        const { error } = await supabase
          .from('delivery_personnel')
          .update(personnelData)
          .eq('id', editingPerson.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Entregador atualizado com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('delivery_personnel')
          .insert([personnelData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Entregador cadastrado com sucesso!"
        });
      }

      resetForm();
      fetchPersonnel();
    } catch (error) {
      console.error('Erro ao salvar entregador:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o entregador.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (person: DeliveryPerson) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      phone: person.phone,
      vehicle_type: person.vehicle_type,
      vehicle_plate: person.vehicle_plate || '',
      status: person.status
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este entregador?')) return;

    try {
      const { error } = await supabase
        .from('delivery_personnel')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Entregador excluído com sucesso!"
      });

      fetchPersonnel();
    } catch (error) {
      console.error('Erro ao excluir entregador:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o entregador.",
        variant: "destructive"
      });
    }
  };

  const updateStatus = async (id: string, newStatus: 'available' | 'busy' | 'offline') => {
    try {
      const { error } = await supabase
        .from('delivery_personnel')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "Status do entregador foi atualizado."
      });

      fetchPersonnel();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      vehicle_type: 'motorcycle',
      vehicle_plate: '',
      status: 'available'
    });
    setEditingPerson(null);
    setShowForm(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-green-500">Disponível</Badge>;
      case 'busy':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Ocupado</Badge>;
      case 'offline':
        return <Badge variant="outline">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType) {
      case 'car':
        return <Car size={16} />;
      case 'motorcycle':
        return <Motorcycle size={16} />;
      case 'bicycle':
        return <Bike size={16} />;
      default:
        return <MapPin size={16} />;
    }
  };

  const getVehicleLabel = (vehicleType: string) => {
    switch (vehicleType) {
      case 'car':
        return 'Carro';
      case 'motorcycle':
        return 'Moto';
      case 'bicycle':
        return 'Bicicleta';
      default:
        return vehicleType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Equipe de Entregadores</h2>
          <p className="text-gray-600">Gerencie sua equipe de delivery</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-2" />
          Novo Entregador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Disponíveis</p>
                <p className="text-2xl font-bold text-green-600">
                  {personnel.filter(p => p.status === 'available').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <MapPin className="text-green-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Em Entrega</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {personnel.filter(p => p.status === 'busy').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Motorcycle className="text-yellow-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-blue-600">{personnel.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Car className="text-blue-600" size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingPerson ? 'Editar Entregador' : 'Novo Entregador'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_type">Tipo de Veículo</Label>
                  <Select 
                    value={formData.vehicle_type} 
                    onValueChange={(value) => setFormData({...formData, vehicle_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorcycle">Moto</SelectItem>
                      <SelectItem value="car">Carro</SelectItem>
                      <SelectItem value="bicycle">Bicicleta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vehicle_plate">Placa do Veículo (opcional)</Label>
                  <Input
                    id="vehicle_plate"
                    value={formData.vehicle_plate}
                    onChange={(e) => setFormData({...formData, vehicle_plate: e.target.value})}
                    placeholder="ABC-1234"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status Inicial</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: 'available' | 'busy' | 'offline') => setFormData({...formData, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingPerson ? 'Atualizar' : 'Cadastrar'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Personnel List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personnel.map((person) => (
          <Card key={person.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{person.name}</CardTitle>
                {getStatusBadge(person.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} />
                  {person.phone}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {getVehicleIcon(person.vehicle_type)}
                  {getVehicleLabel(person.vehicle_type)}
                  {person.vehicle_plate && ` - ${person.vehicle_plate}`}
                </div>

                <div className="flex gap-2 mt-4">
                  <Select 
                    value={person.status} 
                    onValueChange={(value: 'available' | 'busy' | 'offline') => updateStatus(person.id, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponível</SelectItem>
                      <SelectItem value="busy">Ocupado</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(person)}
                    className="flex-1"
                  >
                    <Edit size={14} className="mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(person.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {personnel.length === 0 && (
        <div className="text-center py-12">
          <MapPin size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum entregador cadastrado
          </h3>
          <p className="text-gray-500 mb-4">
            Cadastre entregadores para gerenciar seu delivery.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-2" />
            Cadastrar Primeiro Entregador
          </Button>
        </div>
      )}
    </div>
  );
};

export default DeliveryPersonnelManager;
