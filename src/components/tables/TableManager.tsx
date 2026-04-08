
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users, MousePointer, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { ensureDefaultTables } from '@/utils/tableDefaults';
import TableDetailsModal from './TableDetailsModal';
import AddProductToTableModal from './AddProductToTableModal';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  location?: string;
  current_order_id?: string;
}

const TableManager: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [tableForProducts, setTableForProducts] = useState<Table | null>(null);
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: 4,
    location: ''
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (!user?.id) {
      setTables([]);
      setLoading(false);
      return;
    }

    fetchTables();
  }, [user?.id]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const data = await ensureDefaultTables(user?.id);
      
      const transformedTables = (data || []).map(table => ({
        ...table,
        status: table.status as 'available' | 'occupied' | 'reserved'
      }));
      
      setTables(transformedTables);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar mesas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            table_number: parseInt(formData.table_number),
            capacity: formData.capacity,
            location: formData.location
          })
          .eq('id', editingTable.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tables')
          .insert({
            user_id: user?.id,
            table_number: parseInt(formData.table_number),
            capacity: formData.capacity,
            location: formData.location,
            status: 'available'
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `Mesa ${editingTable ? 'atualizada' : 'criada'} com sucesso.`,
      });

      setShowForm(false);
      setEditingTable(null);
      setFormData({ table_number: '', capacity: 4, location: '' });
      fetchTables();
    } catch (error) {
      console.error('Erro ao salvar mesa:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar mesa.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (tableId: string) => {
    const ok = await confirm({
      title: 'Excluir mesa',
      description: 'Tem certeza que deseja excluir esta mesa?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Mesa excluída com sucesso.",
      });

      fetchTables();
    } catch (error) {
      console.error('Erro ao excluir mesa:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir mesa.",
        variant: "destructive"
      });
    }
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setShowTableDetails(true);
  };

  const handleAddProductsClick = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    setTableForProducts(table);
    setShowAddProducts(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-boracume-green/10 text-boracume-green border-boracume-green/20';
      case 'occupied':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'reserved':
        return 'bg-boracume-orange/10 text-boracume-orange border-boracume-orange/20';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'border-t-boracume-green';
      case 'occupied':
        return 'border-t-red-500';
      case 'reserved':
        return 'border-t-boracume-orange';
      default:
        return 'border-t-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'reserved':
        return 'Reservada';
      default:
        return status;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando mesas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Mesas</h2>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingTable(null);
              setFormData({ table_number: '', capacity: 4, location: '' });
            }}>
              <Plus size={16} className="mr-2" />
              Nova Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTable ? 'Editar Mesa' : 'Nova Mesa'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="table_number">Número da Mesa</Label>
                <Input
                  id="table_number"
                  type="number"
                  value={formData.table_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, table_number: e.target.value }))}
                  placeholder="Ex: 1"
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidade</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
                  placeholder="Ex: 4"
                />
              </div>
              <div>
                <Label htmlFor="location">Localização (opcional)</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ex: Varanda, Salão principal"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  {editingTable ? 'Atualizar' : 'Criar'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 p-4 bg-boracume-orange/5 rounded-xl border border-boracume-orange/20">
        <div className="flex items-center gap-2 mb-2">
          <MousePointer size={16} className="text-boracume-orange" />
          <span className="font-semibold text-boracume-dark-green">Como usar as mesas:</span>
        </div>
        <p className="text-sm text-gray-600">
          <strong>Clique na mesa</strong> para ver detalhes, transferir ou finalizar. 
          <strong className="ml-1">Botão carrinho</strong> para adicionar produtos à mesa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {tables.map((table) => (
          <Card 
            key={table.id} 
            className={`cursor-pointer border-t-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${getBorderColor(table.status)}`}
            onClick={() => handleTableClick(table)}
          >
            <CardHeader className="space-y-2 px-3 pb-1 pt-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base leading-none">Mesa {table.table_number}</CardTitle>
                <Badge variant="outline" className={`${getStatusColor(table.status)} px-2 py-0 text-[10px]`}>
                  {getStatusLabel(table.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Users size={12} />
                  <span>{table.capacity} pessoas</span>
                </div>
                {table.location && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <MousePointer size={12} className="opacity-0" />
                    <span className="truncate">📍 {table.location}</span>
                  </div>
                )}
                {table.status === 'occupied' && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-blue-600">
                    <MousePointer size={12} />
                    <span>Clique para ver detalhes</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-1.5 border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleAddProductsClick(table, e)}
                  className="h-8 flex-1 px-2 hover:bg-boracume-green/10 hover:text-boracume-green hover:border-boracume-green/50"
                  title="Adicionar produtos"
                >
                  <ShoppingCart size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTable(table);
                    setFormData({
                      table_number: table.table_number.toString(),
                      capacity: table.capacity,
                      location: table.location || ''
                    });
                    setShowForm(true);
                  }}
                  className="h-8 px-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  <Edit size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(table.id);
                  }}
                  className="h-8 px-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">Nenhuma mesa cadastrada.</p>
            <Button
              onClick={() => setShowForm(true)}
              className="mt-3"
            >
              <Plus size={16} className="mr-2" />
              Criar Primeira Mesa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Detalhes da Mesa */}
      <TableDetailsModal
        table={selectedTable}
        isOpen={showTableDetails}
        onClose={() => {
          setShowTableDetails(false);
          setSelectedTable(null);
        }}
        onRefresh={fetchTables}
        availableTables={tables}
      />

      {/* Modal de Adicionar Produtos */}
      <AddProductToTableModal
        table={tableForProducts}
        isOpen={showAddProducts}
        onClose={() => {
          setShowAddProducts(false);
          setTableForProducts(null);
        }}
        onSuccess={fetchTables}
      />
    </div>
  );
};

export default TableManager;
