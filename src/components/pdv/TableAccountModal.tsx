
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TableAccountItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  options?: string[];
  notes?: string;
}

interface TableAccount {
  id: string;
  table_id: string;
  items: TableAccountItem[];
  total: number;
  status: 'open' | 'pending_payment' | 'closed';
  created_at: string;
}

interface TableAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: number;
  onAccountUpdate: () => void;
  onFinalize?: (items: TableAccountItem[], total: number, tableNumber: number) => void;
}

const TableAccountModal: React.FC<TableAccountModalProps> = ({
  isOpen,
  onClose,
  tableId,
  tableNumber,
  onAccountUpdate,
  onFinalize
}) => {
  const [account, setAccount] = useState<TableAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && tableId) {
      fetchTableAccount();
    }
  }, [isOpen, tableId]);

  const fetchTableAccount = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Parse items safely
        let parsedItems: TableAccountItem[] = [];
        try {
          if (typeof data.items === 'string') {
            parsedItems = JSON.parse(data.items);
          } else if (Array.isArray(data.items)) {
            parsedItems = data.items as unknown as TableAccountItem[];
          }
        } catch (e) {
          console.error('Error parsing items:', e);
          parsedItems = [];
        }

        setAccount({
          id: data.id,
          table_id: data.table_id,
          items: parsedItems,
          total: data.total,
          status: data.status as 'open' | 'pending_payment' | 'closed',
          created_at: data.created_at
        });
      } else {
        setAccount(null);
      }
    } catch (error) {
      console.error('Erro ao carregar conta da mesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a conta da mesa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = async (itemIndex: number, newQuantity: number) => {
    if (!account) return;

    const updatedItems = [...account.items];
    if (newQuantity <= 0) {
      updatedItems.splice(itemIndex, 1);
    } else {
      updatedItems[itemIndex].quantity = newQuantity;
      updatedItems[itemIndex].subtotal = updatedItems[itemIndex].price * newQuantity;
    }

    const newTotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);

    try {
      const { error } = await supabase
        .from('table_accounts')
        .update({
          items: JSON.stringify(updatedItems),
          total: newTotal
        })
        .eq('id', account.id);

      if (error) throw error;

      setAccount({ ...account, items: updatedItems, total: newTotal });
      onAccountUpdate();
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o item.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleFinalizeAccount = async () => {
    if (!account) return;

    try {
      // First update the account status to closed
      const { error: accountError } = await supabase
        .from('table_accounts')
        .update({ status: 'closed' })
        .eq('id', account.id);

      if (accountError) throw accountError;

      // Then update table status to available
      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', tableId);

      if (tableError) throw tableError;

      toast({
        title: "Conta finalizada!",
        description: "A conta da mesa foi transferida para o PDV.",
      });

      // Pass the account data to finalize in PDV
      if (onFinalize) {
        onFinalize(account.items, account.total, tableNumber);
      }

      onClose();
      onAccountUpdate();
    } catch (error) {
      console.error('Erro ao finalizar conta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar a conta.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mesa {tableNumber} - Conta</DialogTitle>
        </DialogHeader>

        {!account ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhuma conta aberta para esta mesa.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Itens do Pedido</h3>
              
              {account.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(item.price)} cada
                    </p>
                    {item.options && item.options.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.options.map((option: string, optIndex: number) => (
                          <div key={optIndex}>• {option}</div>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-1 italic">
                        Obs: {item.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateItemQuantity(index, item.quantity - 1)}
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateItemQuantity(index, item.quantity + 1)}
                    >
                      <Plus size={12} />
                    </Button>
                    <span className="w-20 text-right font-medium">
                      {formatCurrency(item.subtotal)}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => updateItemQuantity(index, 0)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Total:</span>
              <span className="text-lg font-bold">
                {formatCurrency(account.total)}
              </span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Fechar
              </Button>
              <Button 
                onClick={handleFinalizeAccount}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={account.items.length === 0}
              >
                Finalizar Mesa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TableAccountModal;
