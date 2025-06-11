
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TableAccount {
  id: string;
  table_id: string;
  table_number: number;
  items: any[];
  total: number;
  status: 'open' | 'pending_payment';
  created_at: string;
}

interface TableAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: number;
  onAccountUpdate: () => void;
  onFinalize?: (items: any[], total: number, tableNumber: number) => void;
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
      const { data, error } = await (supabase as any)
        .from('table_accounts')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setAccount(data);
    } catch (error) {
      console.error('Erro ao carregar conta da mesa:', error);
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
      const { error } = await (supabase as any)
        .from('table_accounts')
        .update({
          items: updatedItems,
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
      // Close the table account
      const { error } = await (supabase as any)
        .from('table_accounts')
        .update({ status: 'closed' })
        .eq('id', account.id);

      if (error) throw error;

      // Update table status to available
      await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', tableId);

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
          <div className="flex items-center justify-center py-8">
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
          <DialogTitle className="flex items-center gap-2">
            Conta da Mesa {tableNumber}
            <Badge variant={account ? "default" : "secondary"}>
              {account ? "Conta Aberta" : "Sem Conta"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!account ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Esta mesa não possui conta aberta.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
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
                      <span className="w-20 text-right">{formatCurrency(item.subtotal)}</span>
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

              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(account.total)}</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Fechar
                </Button>
                <Button 
                  onClick={handleFinalizeAccount} 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Finalizar Conta
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableAccountModal;
