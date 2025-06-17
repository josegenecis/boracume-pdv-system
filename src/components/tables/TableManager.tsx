
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, DollarSign, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TableDetailsModal from '@/components/tables/TableDetailsModal';

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
}

interface TableAccount {
  id: string;
  table_id: string;
  items: any[];
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const TableManager = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [tableAccounts, setTableAccounts] = useState<TableAccount[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchTables();
      fetchTableAccounts();
    }
  }, [user]);

  const fetchTables = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user.id)
        .order('table_number');

      if (error) throw error;

      setTables(data?.map(table => ({
        id: table.id,
        number: table.table_number,
        capacity: table.capacity || 4,
        status: table.status as 'available' | 'occupied' | 'reserved'
      })) || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mesas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTableAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open');

      if (error) throw error;

      setTableAccounts(data?.map(account => ({
        ...account,
        items: Array.isArray(account.items) ? account.items : []
      })) || []);
    } catch (error) {
      console.error('Error fetching table accounts:', error);
    }
  };

  const addTable = async () => {
    if (!user || !newTableNumber || !newTableCapacity) return;

    try {
      const { data, error } = await supabase
        .from('tables')
        .insert({
          user_id: user.id,
          table_number: parseInt(newTableNumber),
          capacity: parseInt(newTableCapacity),
          status: 'available'
        })
        .select()
        .single();

      if (error) throw error;

      const newTable: Table = {
        id: data.id,
        number: data.table_number,
        capacity: data.capacity,
        status: data.status as 'available' | 'occupied' | 'reserved'
      };

      setTables(prev => [...prev, newTable].sort((a, b) => a.number - b.number));
      setNewTableNumber('');
      setNewTableCapacity('');
      setShowAddTable(false);

      toast({
        title: "Mesa adicionada",
        description: `Mesa ${newTableNumber} foi adicionada com sucesso.`,
      });
    } catch (error) {
      console.error('Error adding table:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a mesa.",
        variant: "destructive"
      });
    }
  };

  const getTableStatus = (table: Table) => {
    const account = tableAccounts.find(acc => acc.table_id === table.id);
    if (account) return 'occupied';
    return table.status;
  };

  const getTableAccount = (tableId: string) => {
    return tableAccounts.find(acc => acc.table_id === tableId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'occupied':
        return 'bg-red-500';
      case 'reserved':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'reserved':
        return 'Reservada';
      default:
        return 'Desconhecido';
    }
  };

  if (loading) {
    return <div>Carregando mesas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciamento de Mesas</h2>
        <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Mesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-number">Número da Mesa</Label>
                <Input
                  id="table-number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ex: 1"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-capacity">Capacidade</Label>
                <Input
                  id="table-capacity"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                  placeholder="Ex: 4"
                  type="number"
                />
              </div>
              <Button onClick={addTable} className="w-full">
                Adicionar Mesa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => {
          const status = getTableStatus(table);
          const account = getTableAccount(table.id);
          
          return (
            <Card 
              key={table.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                status === 'occupied' ? 'ring-2 ring-red-200' : ''
              }`}
              onClick={() => setSelectedTable(table)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Mesa {table.number}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Capacidade:</span>
                  <span className="text-sm font-medium">{table.capacity} pessoas</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={status === 'available' ? 'default' : 'secondary'}>
                    {getStatusText(status)}
                  </Badge>
                </div>
                {account && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total:</span>
                      <span className="text-sm font-bold text-green-600">
                        R$ {account.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Itens:</span>
                      <span className="text-sm">{account.items.length}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedTable && (
        <TableDetailsModal
          table={selectedTable}
          account={getTableAccount(selectedTable.id)}
          isOpen={!!selectedTable}
          onClose={() => setSelectedTable(null)}
          onAccountUpdate={fetchTableAccounts}
        />
      )}
    </div>
  );
};

export default TableManager;
