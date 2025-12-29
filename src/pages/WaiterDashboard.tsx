import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, PlusCircle, Utensils, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TableOrder {
  id: string;
  table_number: string;
  status: string;
  customer_name: string;
  total_amount: number;
}

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waiter, setWaiter] = useState<any>(null);
  const [tables, setTables] = useState<TableOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem('waiter_session');
    if (!session) {
      navigate('/waiter-login');
      return;
    }
    setWaiter(JSON.parse(session));
  }, [navigate]);

  useEffect(() => {
    if (waiter) {
      loadTables();
      
      // Subscribe to changes
      const channel = supabase
        .channel('public:orders')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${waiter.restaurant_id}`
        }, () => {
          loadTables();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [waiter]);

  const loadTables = async () => {
    if (!waiter) return;
    setLoading(true);
    try {
      // Fetch open orders with table numbers
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', waiter.restaurant_id)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .not('table_number', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('waiter_session');
    navigate('/waiter-login');
  };

  const handleNewOrder = () => {
    // Navigate to PDV with waiter context
    navigate(`/pdv?waiterId=${waiter.id}&mode=waiter`);
  };

  const handleOpenTable = (orderId: string) => {
    // Open existing order in PDV
    navigate(`/pdv?orderId=${orderId}&waiterId=${waiter.id}&mode=waiter`);
  };

  if (initialCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!waiter) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <Utensils className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Área do Garçom</h1>
            <p className="text-xs text-muted-foreground">Olá, {waiter.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-gray-500">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-3xl mx-auto w-full space-y-4">
        
        {/* Actions */}
        <Button 
          size="lg" 
          className="w-full h-16 text-lg shadow-md bg-primary hover:bg-primary/90"
          onClick={handleNewOrder}
        >
          <PlusCircle className="mr-2 h-6 w-6" />
          Novo Pedido / Mesa
        </Button>

        <div className="flex items-center justify-between mt-6 mb-2">
          <h2 className="font-semibold text-gray-700">Mesas Abertas ({tables.length})</h2>
          <Button variant="ghost" size="sm" onClick={loadTables} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tables Grid */}
        {tables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
            <p>Nenhuma mesa aberta no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tables.map((table) => (
              <Card 
                key={table.id} 
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-95 border-l-4 border-l-green-500"
                onClick={() => handleOpenTable(table.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-lg font-bold px-2 py-1 bg-gray-50">
                      Mesa {table.table_number}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">
                      R$ {table.total_amount?.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {table.customer_name || 'Cliente sem nome'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(table.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default WaiterDashboard;