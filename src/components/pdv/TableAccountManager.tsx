
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Calculator, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TableAccountModal from './TableAccountModal';

interface Table {
  id: string;
  table_number: number;
  status: string;
  capacity: number;
  location?: string;
}

interface TableAccount {
  id: string;
  table_id: string;
  items: any[];
  total: number;
  status: string;
  created_at: string;
}

interface TableAccountManagerProps {
  onFinalize?: () => void;
}

const TableAccountManager: React.FC<TableAccountManagerProps> = ({ onFinalize }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [tableAccounts, setTableAccounts] = useState<Record<string, TableAccount>>({});
  const [selectedTable, setSelectedTable] = useState<{ id: string; number: number } | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchTables();
    fetchTableAccounts();
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number');

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
    }
  };

  const fetchTableAccounts = async () => {
    try {
      // Use rpc ou query direta para contornar problemas de tipagem
      const { data, error } = await (supabase as any)
        .from('table_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'open');

      if (error) throw error;
      
      const accountsMap = (data || []).reduce((acc: Record<string, TableAccount>, account: any) => {
        acc[account.table_id] = account;
        return acc;
      }, {});
      
      setTableAccounts(accountsMap);
    } catch (error) {
      console.error('Erro ao carregar contas das mesas:', error);
    }
  };

  const getTableStatus = (table: Table) => {
    const hasAccount = tableAccounts[table.id];
    if (hasAccount) return 'open_account';
    return table.status;
  };

  const getStatusBadge = (status: string, total?: number) => {
    switch (status) {
      case 'open_account':
        return <Badge variant="default">Conta Aberta</Badge>;
      case 'occupied':
        return <Badge variant="secondary">Ocupada</Badge>;
      case 'available':
        return <Badge variant="outline">Disponível</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleViewAccount = (table: Table) => {
    setSelectedTable({ id: table.id, number: table.table_number });
    setShowAccountModal(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Gerenciar Mesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Nenhuma mesa cadastrada. Configure as mesas em "Mesas".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table) => {
                const status = getTableStatus(table);
                const account = tableAccounts[table.id];
                
                return (
                  <Card key={table.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="text-center space-y-2">
                        <h3 className="font-bold text-lg">Mesa {table.table_number}</h3>
                        {getStatusBadge(status)}
                        
                        {table.location && (
                          <p className="text-xs text-gray-500">{table.location}</p>
                        )}
                        
                        <p className="text-xs text-gray-500">
                          Capacidade: {table.capacity} pessoas
                        </p>
                        
                        {account && (
                          <>
                            <p className="text-sm font-medium text-green-600">
                              {formatCurrency(account.total)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {account.items.length} item(s)
                            </p>
                          </>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewAccount(table)}
                            className="flex-1"
                          >
                            <Eye size={14} className="mr-1" />
                            Ver
                          </Button>
                          {account && (
                            <Button
                              size="sm"
                              onClick={() => handleViewAccount(table)}
                              className="flex-1"
                            >
                              <Calculator size={14} className="mr-1" />
                              Finalizar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTable && (
        <TableAccountModal
          isOpen={showAccountModal}
          onClose={() => {
            setShowAccountModal(false);
            setSelectedTable(null);
          }}
          tableId={selectedTable.id}
          tableNumber={selectedTable.number}
          onAccountUpdate={() => {
            fetchTableAccounts();
            fetchTables();
          }}
          onFinalize={onFinalize}
        />
      )}
    </div>
  );
};

export default TableAccountManager;
