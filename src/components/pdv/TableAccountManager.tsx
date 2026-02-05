
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
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
  onFinalize?: (items: any[], total: number, tableNumber: number, tableId: string) => void;
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
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {tables.map((table) => {
                const status = getTableStatus(table);
                const account = tableAccounts[table.id];

                const base =
                  status === 'open_account'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : status === 'occupied'
                    ? 'bg-gray-200 text-gray-900 border-gray-300'
                    : 'bg-white text-gray-900 border-gray-200'

                return (
                  <button
                    key={table.id}
                    onClick={() => handleViewAccount(table)}
                    className={`border rounded-md h-14 w-full flex flex-col items-center justify-center gap-0.5 hover:shadow-sm transition-shadow ${base}`}
                    title={`Mesa ${table.table_number}`}
                  >
                    <div className="text-lg font-bold leading-none">{table.table_number}</div>
                    {account ? (
                      <div className="text-[10px] leading-none opacity-95">{formatCurrency(account.total)}</div>
                    ) : (
                      <div className="text-[10px] leading-none opacity-70">
                        {status === 'occupied' ? 'Ocupada' : 'Livre'}
                      </div>
                    )}
                  </button>
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
