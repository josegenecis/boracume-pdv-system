import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface TableData {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

const Mesas = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [newTable, setNewTable] = useState({ table_number: 0, capacity: 4 });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTables();
    }
  }, [user]);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number');
      
      if (error) throw error;
      setTables(data || []);
    } catch (error: any) {
      console.warn('Tables table not ready yet:', error);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTable = async () => {
    if (!user || newTable.table_number <= 0) return;

    try {
      setIsLoading(true);
      
      if (editingTable) {
        const { error } = await (supabase as any)
          .from('tables')
          .update({
            table_number: newTable.table_number,
            capacity: newTable.capacity,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTable.id);
        
        if (error) throw error;
        
        toast({
          title: 'Mesa atualizada',
          description: 'As informações da mesa foram atualizadas com sucesso.',
        });
      } else {
        const { error } = await (supabase as any)
          .from('tables')
          .insert({
            user_id: user.id,
            table_number: newTable.table_number,
            capacity: newTable.capacity,
            status: 'available'
          });
        
        if (error) throw error;
        
        toast({
          title: 'Mesa adicionada',
          description: 'A nova mesa foi adicionada com sucesso.',
        });
      }
      
      setNewTable({ table_number: 0, capacity: 4 });
      setEditingTable(null);
      fetchTables();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar mesa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTable = (table: TableData) => {
    setEditingTable(table);
    setNewTable({ table_number: table.table_number, capacity: table.capacity });
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mesa?')) return;

    try {
      setIsLoading(true);
      const { error } = await (supabase as any)
        .from('tables')
        .delete()
        .eq('id', tableId);
      
      if (error) throw error;
      
      toast({
        title: 'Mesa excluída',
        description: 'A mesa foi excluída com sucesso.',
      });
      
      fetchTables();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir mesa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { label: 'Disponível', variant: 'secondary' as const },
      occupied: { label: 'Ocupada', variant: 'destructive' as const },
      reserved: { label: 'Reservada', variant: 'default' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { label: status, variant: 'outline' as const };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <UtensilsCrossed className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Gerenciar Mesas</h1>
        </div>

        {/* Formulário para adicionar/editar mesa */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTable ? 'Editar Mesa' : 'Adicionar Nova Mesa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="table_number">Número da Mesa</Label>
                <Input
                  id="table_number"
                  type="number"
                  min="1"
                  value={newTable.table_number || ''}
                  onChange={(e) => setNewTable({ ...newTable, table_number: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 1, 2, 3..."
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidade (pessoas)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={newTable.capacity}
                  onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 4 })}
                  placeholder="4"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleSaveTable} 
                disabled={isLoading || newTable.table_number <= 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                {editingTable ? 'Atualizar' : 'Adicionar'} Mesa
              </Button>
              {editingTable && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditingTable(null);
                    setNewTable({ table_number: 0, capacity: 4 });
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de mesas */}
        <Card>
          <CardHeader>
            <CardTitle>Mesas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {tables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma mesa cadastrada ainda.</p>
                <p className="text-sm">Adicione mesas para organizar o atendimento.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell className="font-medium">Mesa {table.table_number}</TableCell>
                      <TableCell>{table.capacity} pessoas</TableCell>
                      <TableCell>{getStatusBadge(table.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTable(table)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTable(table.id)}
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

export default Mesas;
