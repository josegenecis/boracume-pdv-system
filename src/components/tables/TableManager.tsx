import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users, MousePointer, PackagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { ensureDefaultTables } from '@/utils/tableDefaults';
import TableDetailsModal from './TableDetailsModal';
import AddProductToTableModal from './AddProductToTableModal';
import StaffConsumptionManager from './StaffConsumptionManager';

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
    location: '',
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirmDialog();
  const { isMobile } = useSidebar();

  useEffect(() => {
    if (!user?.id) {
      setTables([]);
      setLoading(false);
      return;
    }

    void fetchTables();
  }, [user?.id]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const data = await ensureDefaultTables(user?.id);

      const transformedTables = (data || []).map((table) => ({
        ...table,
        status: table.status as 'available' | 'occupied' | 'reserved',
      }));

      setTables(transformedTables);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mesas.',
        variant: 'destructive',
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
            location: formData.location,
          })
          .eq('id', editingTable.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('tables').insert({
          user_id: user?.id,
          table_number: parseInt(formData.table_number),
          capacity: formData.capacity,
          location: formData.location,
          status: 'available',
        });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: `Mesa ${editingTable ? 'atualizada' : 'criada'} com sucesso.`,
      });

      setShowForm(false);
      setEditingTable(null);
      setFormData({ table_number: '', capacity: 4, location: '' });
      void fetchTables();
    } catch (error) {
      console.error('Erro ao salvar mesa:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar mesa.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (tableId: string) => {
    const table = tables.find((item) => item.id === tableId);
    if (table?.status === 'occupied') {
      toast({
        title: 'Mesa com conta aberta',
        description: 'Feche, transfira ou lance a conta como consumo de funcionário antes de arquivar a mesa.',
        variant: 'destructive',
      });
      return;
    }

    const ok = await confirm({
      title: 'Arquivar mesa',
      description: 'A mesa sairá da operação, mas todo o histórico será preservado para auditoria.',
      confirmText: 'Arquivar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('tables')
        .update({
          archived_at: new Date().toISOString(),
          archived_by: user?.id || null,
          status: 'available',
        })
        .eq('id', tableId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Mesa arquivada sem apagar o histórico.',
      });

      void fetchTables();
    } catch (error) {
      console.error('Erro ao excluir mesa:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao arquivar mesa.',
        variant: 'destructive',
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
        return 'Disponivel';
      case 'occupied':
        return 'Ocupada';
      case 'reserved':
        return 'Reservada';
      default:
        return status;
    }
  };

  const getMobileStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Livre';
      case 'occupied':
        return 'Uso';
      case 'reserved':
        return 'Res.';
      default:
        return status;
    }
  };

  const availableCount = tables.filter((table) => table.status === 'available').length;
  const occupiedCount = tables.filter((table) => table.status === 'occupied').length;
  const reservedCount = tables.filter((table) => table.status === 'reserved').length;

  if (loading) {
    return <div className="py-8 text-center">Carregando mesas...</div>;
  }

  return (
    <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
      <div className={`flex ${isMobile ? 'items-center justify-end' : 'items-center justify-between'} gap-2`}>
        {!isMobile && (
          <div>
            <h2 className="text-xl font-bold">Operacao de Mesas</h2>
            <p className="text-sm text-muted-foreground">Abra, acompanhe, transfira e feche contas sem sair do salao.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StaffConsumptionManager />
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button
              className={isMobile ? 'h-8 rounded-xl px-3 text-[11px]' : ''}
              onClick={() => {
                setEditingTable(null);
                setFormData({ table_number: '', capacity: 4, location: '' });
              }}
            >
              <Plus size={16} className={isMobile ? '' : 'mr-2'} />
              {isMobile ? 'Nova' : 'Nova Mesa'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Editar Mesa' : 'Nova Mesa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="table_number">Numero da Mesa</Label>
                <Input
                  id="table_number"
                  type="number"
                  value={formData.table_number}
                  onChange={(e) => setFormData((prev) => ({ ...prev, table_number: e.target.value }))}
                  placeholder="Ex: 1"
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacidade</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
                  placeholder="Ex: 4"
                />
              </div>
              <div>
                <Label htmlFor="location">Localizacao (opcional)</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Ex: Varanda, Salao principal"
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
      </div>

      {!isMobile && (
        <>
          <div className="grid gap-2 md:grid-cols-3">
            <Card className="border-emerald-100 bg-emerald-50/60">
              <CardContent className="p-3">
                <div className="text-sm text-emerald-700">Mesas livres</div>
                <div className="mt-1 text-2xl font-black text-emerald-900">{availableCount}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-100 bg-amber-50/70">
              <CardContent className="p-3">
                <div className="text-sm text-amber-700">Em atendimento</div>
                <div className="mt-1 text-2xl font-black text-amber-900">{occupiedCount}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-3">
                <div className="text-sm text-slate-600">Reservadas</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{reservedCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-2 rounded-xl border border-boracume-orange/20 bg-boracume-orange/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <MousePointer size={16} className="text-boracume-orange" />
              <span className="font-semibold text-boracume-dark-green">Fluxo rapido de operacao:</span>
            </div>
            <p className="text-sm text-gray-600">
              <strong>Clique na mesa</strong> para acompanhar a conta, imprimir parcial, transferir ou fechar com pagamento.
              <strong className="ml-1">ADD PRODUTO</strong> para lançar itens na mesa.
            </p>
          </div>
        </>
      )}

      <div className={isMobile ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'}>
        {tables.map((table) => (
          <Card
            key={table.id}
            className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isMobile ? 'aspect-square rounded-[18px] border-0 shadow-sm' : `border-t-4 ${getBorderColor(table.status)}`}`}
            onClick={() => handleTableClick(table)}
          >
            <CardHeader className={isMobile ? 'space-y-1 px-2 pb-0 pt-2' : 'space-y-2 px-3 pb-1 pt-3'}>
              <div className="flex items-start justify-between">
                <CardTitle className={isMobile ? 'text-[11px] leading-none' : 'text-base leading-none'}>Mesa {table.table_number}</CardTitle>
                <Badge variant="outline" className={`${getStatusColor(table.status)} ${isMobile ? 'px-1.5 py-0 text-[8px]' : 'px-2 py-0 text-[10px]'}`}>
                  {isMobile ? getMobileStatusLabel(table.status) : getStatusLabel(table.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className={isMobile ? 'px-2 pb-2 pt-1' : 'px-3 pb-3 pt-0'}>
              <div className={isMobile ? 'space-y-1' : 'space-y-1.5'}>
                <div className={`flex items-center gap-1.5 text-gray-600 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                  <Users size={12} />
                  <span>{table.capacity} pessoas</span>
                </div>
                {!isMobile && table.location && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <MousePointer size={12} className="opacity-0" />
                    <span className="truncate">Local: {table.location}</span>
                  </div>
                )}
              </div>
              <div className={`${isMobile ? 'mt-2 flex gap-1 border-t border-gray-100 pt-2' : 'mt-3 flex gap-1.5 border-t border-gray-100 pt-3'}`} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleAddProductsClick(table, e)}
                  className={`${isMobile ? 'h-7 flex-1 rounded-xl px-1 text-[8px]' : 'h-8 flex-1 px-2 text-xs'} hover:border-boracume-green/50 hover:bg-boracume-green/10 hover:text-boracume-green`}
                  title="Adicionar produtos"
                >
                  <PackagePlus size={isMobile ? 11 : 14} />
                  <span>ADD PRODUTO</span>
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
                      location: table.location || '',
                    });
                    setShowForm(true);
                  }}
                  className={`${isMobile ? 'h-7 rounded-xl px-1.5' : 'h-8 px-2'} hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600`}
                >
                  <Edit size={isMobile ? 12 : 14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(table.id);
                  }}
                  className={`${isMobile ? 'h-7 rounded-xl px-1.5' : 'h-8 px-2'} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                  title="Arquivar mesa sem apagar o histórico"
                >
                  <Trash2 size={isMobile ? 12 : 14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Nenhuma mesa cadastrada.</p>
            <Button onClick={() => setShowForm(true)} className="mt-3">
              <Plus size={16} className="mr-2" />
              Criar Primeira Mesa
            </Button>
          </CardContent>
        </Card>
      )}

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
