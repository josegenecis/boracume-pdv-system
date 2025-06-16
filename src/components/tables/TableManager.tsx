
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Clock, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TableDetailsModal from './TableDetailsModal';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location?: string;
}

interface TableAccount {
  id: string;
  table_id: string;
  total: number;
  status: string;
  items: any[];
  created_at: string;
}

const TableManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [accounts, setAccounts] = useState<TableAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTables();
      fetchAccounts();
    }
  }, [user]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number');

      if (error) {
        console.error('Erro ao buscar mesas:', error);
        return;
      }

      setTables(data || []);
    } catch (error) {
      console.error('Erro ao buscar mesas:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'open');

      if (error) {
        console.error('Erro ao buscar contas:', error);
        return;
      }

      setAccounts(data || []);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTable = async () => {
    if (!user) return;

    try {
      const nextNumber = Math.max(...tables.map(t => t.table_number), 0) + 1;
      
      const { data, error } = await supabase
        .from('tables')
        .insert([{
          user_id: user.id,
          table_number: nextNumber,
          capacity: 4,
          status: 'available'
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar mesa:', error);
        toast({
          title: "Erro ao criar mesa",
          description: "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      setTables(prev => [...prev, data]);
      toast({
        title: "Mesa criada com sucesso!",
        description: `Mesa ${nextNumber} foi adicionada.`,
      });
    } catch (error) {
      console.error('Erro ao criar mesa:', error);
    }
  };

  const getTableAccount = (tableId: string) => {
    return accounts.find(account => account.table_id === tableId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-red-100 text-red-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        return 'Indisponível';
    }
  };

  const openTableDetails = (table: Table) => {
    setSelectedTable(table);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedTable(null);
    setShowModal(false);
    fetchTables();
    fetchAccounts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciamento de Mesas</h2>
        <Button onClick={createTable}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Mesa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => {
          const account = getTableAccount(table.id);
          const hasAccount = !!account;
          
          return (
            <Card 
              key={table.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                hasAccount ? 'ring-2 ring-orange-500' : ''
              }`}
              onClick={() => openTableDetails(table)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">
                    Mesa {table.table_number}
                  </CardTitle>
                  <Badge className={getStatusColor(hasAccount ? 'occupied' : table.status)}>
                    {hasAccount ? 'Ocupada' : getStatusText(table.status)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Capacidade: {table.capacity} pessoas</span>
                </div>
                
                {table.location && (
                  <div className="text-sm text-muted-foreground">
                    <span>📍 {table.location}</span>
                  </div>
                )}

                {hasAccount && account && (
                  <div className="space-y-2 p-3 bg-orange-50 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                      <Clock className="h-4 w-4" />
                      Conta aberta
                    </div>
                    <div className="text-sm text-orange-700">
                      Total: R$ {Number(account.total).toFixed(2)}
                    </div>
                    <div className="text-xs text-orange-600">
                      Items: {account.items.length}
                    </div>
                  </div>
                )}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTableDetails(table);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {hasAccount ? 'Ver Conta' : 'Gerenciar'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Nenhuma mesa cadastrada
          </h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira mesa para começar a gerenciar o atendimento presencial.
          </p>
          <Button onClick={createTable}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Mesa
          </Button>
        </div>
      )}

      {selectedTable && (
        <TableDetailsModal
          table={selectedTable}
          account={getTableAccount(selectedTable.id)}
          isOpen={showModal}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default TableManager;
