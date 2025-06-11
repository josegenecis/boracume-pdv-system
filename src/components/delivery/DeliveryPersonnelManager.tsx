
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, User, Phone, Bike, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'motorcycle' | 'car';
  vehicle_plate?: string;
  status: 'available' | 'busy' | 'offline';
  created_at: string;
  updated_at: string;
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
    vehicle_type: 'bike' as 'bike' | 'motorcycle' | 'car',
    vehicle_plate: '',
    status: 'available' as 'available' | 'busy' | 'offline'
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
      
      const typedPersonnel: DeliveryPerson[] = (data || []).map(person => ({
        id: person.id,
        name: person.name,
        phone: person.phone,
        vehicle_type: person.vehicle_type as 'bike' | 'motorcycle' | 'car',
        vehicle_plate: person.vehicle_plate,
        status: ['available', 'busy', 'offline'].includes(person.status) 
          ? person.status as 'available' | 'busy' | 'offline'
          : 'available',
        created_at: person.created_at,
        updated_at: person.updated_at
      }));
      
      setPersonnel(typedPersonnel);
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
          description: "Entregador adicionado com sucesso!"
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
      vehicle_type: 'bike',
      vehicle_plate: '',
      status: 'available'
    });
    setEditingPerson(null);
    setShowForm(false);
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'bike':
        return <Bike size={20} />;
      case 'motorcycle':
        return <Bike size={20} />;
      case 'car':
        return <Car size={20} />;
      default:
        return <Bike size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'busy':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'busy':
        return 'Ocupado';
      case 'offline':
        return 'Offline';
      default:
        return 'Desconhecido';
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
          <h2 className="text-2xl font-bold">Entregadores</h2>
          <p className="text-gray-600">Gerencie sua equipe de entrega</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-2" />
          Novo Entregador
        </Button>
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
                  <Label htmlFor="name">Nome</Label>
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
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_type">Tipo de Veículo</Label>
                  <select
                    id="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({...formData, vehicle_type: e.target.value as 'bike' | 'motorcycle' | 'car'})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="bike">Bicicleta</option>
                    <option value="motorcycle">Moto</option>
                    <option value="car">Carro</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="vehicle_plate">Placa do Veículo</Label>
                  <Input
                    id="vehicle_plate"
                    value={formData.vehicle_plate}
                    onChange={(e) => setFormData({...formData, vehicle_plate: e.target.value})}
                    placeholder="ABC-1234"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as 'available' | 'busy' | 'offline'})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="available">Disponível</option>
                  <option value="busy">Ocupado</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingPerson ? 'Atualizar' : 'Adicionar'} Entregador
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personnel.map((person) => (
          <Card key={person.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <User size={20} />
                  <CardTitle className="text-lg">{person.name}</CardTitle>
                </div>
                <Badge className={getStatusColor(person.status)}>
                  {getStatusText(person.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={16} />
                  {person.phone}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {getVehicleIcon(person.vehicle_type)}
                  <span className="capitalize">{person.vehicle_type}</span>
                  {person.vehicle_plate && (
                    <span className="text-gray-400">({person.vehicle_plate})</span>
                  )}
                </div>

                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant={person.status === 'available' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(person.id, 'available')}
                  >
                    Disponível
                  </Button>
                  <Button
                    variant={person.status === 'busy' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(person.id, 'busy')}
                  >
                    Ocupado
                  </Button>
                  <Button
                    variant={person.status === 'offline' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(person.id, 'offline')}
                  >
                    Offline
                  </Button>
                </div>

                <div className="flex gap-2 pt-2">
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
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum entregador cadastrado
          </h3>
          <p className="text-gray-500 mb-4">
            Adicione entregadores à sua equipe para começar.
          </p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-2" />
            Adicionar Primeiro Entregador
          </Button>
        </div>
      )}
    </div>
  );
};

export default DeliveryPersonnelManager;
