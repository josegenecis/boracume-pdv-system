
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  current_order_id?: string;
  created_at: string;
}

const Mesas = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', capacity: 4 });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTables();
    }
  }, [user]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number', { ascending: true });

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mesas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async () => {
    if (!newTable.number || newTable.capacity < 1) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos corretamente.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tables')
        .insert({
          user_id: user?.id,
          table_number: parseInt(newTable.number),
          capacity: newTable.capacity,
          status: 'available'
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Mesa criada com sucesso.",
      });

      setNewTable({ number: '', capacity: 4 });
      setShowDialog(false);
      fetchTables();
    } catch (error: any) {
      console.error('Erro ao criar mesa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a mesa.",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (tableId: string, newStatus: 'available' | 'occupied' | 'reserved') => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ 
          status: newStatus,
          current_order_id: newStatus === 'available' ? null : undefined
        })
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: "O status da mesa foi atualizado com sucesso.",
      });

      fetchTables();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da mesa.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: "Mesa excluída!",
        description: "A mesa foi excluída com sucesso.",
      });

      fetchTables();
    } catch (error: any) {
      console.error('Erro ao excluir mesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a mesa.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      available: { label: 'Disponível', variant: 'secondary' as const, color: 'bg-green-100 text-green-800' },
      occupied: { label: 'Ocupada', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
      reserved: { label: 'Reservada', variant: 'default' as const, color: 'bg-yellow-100 text-yellow-800' },
    };

    const statusConfig = config[status as keyof typeof config] || config.available;
    
    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getStatusActions = (table: Table) => {
    const actions = [];
    
    if (table.status === 'available') {
      actions.push(
        <Button
          key="occupy"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(table.id, 'occupied')}
        >
          Ocupar
        </Button>,
        <Button
          key="reserve"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(table.id, 'reserved')}
        >
          Reservar
        </Button>
      );
    }
    
    if (table.status === 'occupied') {
      actions.push(
        <Button
          key="free"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(table.id, 'available')}
        >
          Liberar
        </Button>
      );
    }
    
    if (table.status === 'reserved') {
      actions.push(
        <Button
          key="occupy"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(table.id, 'occupied')}
        >
          Ocupar
        </Button>,
        <Button
          key="cancel"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(table.id, 'available')}
        >
          Cancelar Reserva
        </Button>
      );
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Mesas</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Gerenciar Mesas</h1>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={18} className="mr-2" /> Nova Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Mesa</DialogTitle>
              <DialogDescription>
                Adicione uma nova mesa ao seu restaurante.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="table-number">Número da Mesa</Label>
                <Input
                  id="table-number"
                  type="number"
                  placeholder="Ex: 1"
                  value={newTable.number}
                  onChange={(e) => setNewTable(prev => ({ ...prev, number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidade (pessoas)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Ex: 4"
                  value={newTable.capacity}
                  onChange={(e) => setNewTable(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTable}>
                Criar Mesa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma mesa cadastrada</h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando sua primeira mesa.
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus size={18} className="mr-2" /> Adicionar Mesa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => (
            <Card key={table.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Mesa {table.table_number}</CardTitle>
                  {getStatusBadge(table.status)}
                </div>
                <CardDescription className="flex items-center gap-1">
                  <Users size={14} />
                  {table.capacity} pessoas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {getStatusActions(table)}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDeleteTable(table.id)}
                >
                  Excluir Mesa
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumo das mesas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mesas Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tables.filter(t => t.status === 'available').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mesas Ocupadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {tables.filter(t => t.status === 'occupied').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mesas Reservadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {tables.filter(t => t.status === 'reserved').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Mesas;
