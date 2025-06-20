
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Table {
  id: string;
  table_number: number;
  status: string;
  capacity: number;
  location?: string;
}

interface AddProductToTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  quantity: number;
  variations: any[];
  notes: string;
  totalPrice: number;
  onSuccess?: () => void;
}

const AddProductToTableModal: React.FC<AddProductToTableModalProps> = ({
  isOpen,
  onClose,
  product,
  quantity,
  variations,
  notes,
  totalPrice,
  onSuccess
}) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      fetchTables();
    }
  }, [isOpen, user]);

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
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as mesas.',
        variant: 'destructive',
      });
    }
  };

  const handleAddToTable = async () => {
    if (!selectedTableId) {
      toast({
        title: 'Mesa não selecionada',
        description: 'Selecione uma mesa para adicionar o produto.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar conta existente da mesa ou criar nova
      let { data: existingAccount, error: fetchError } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('table_id', selectedTableId)
        .eq('status', 'open')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const newItem = {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        variations: variations || [],
        notes: notes || '',
        subtotal: totalPrice
      };

      if (existingAccount) {
        // Atualizar conta existente
        let currentItems = [];
        try {
          // Converter Json para array de forma segura
          if (existingAccount.items && typeof existingAccount.items === 'object') {
            if (Array.isArray(existingAccount.items)) {
              currentItems = existingAccount.items;
            } else {
              // Se items é um objeto Json, tentar converter para array
              currentItems = Object.values(existingAccount.items);
            }
          }
        } catch (e) {
          console.error('Erro ao processar items existentes:', e);
          currentItems = [];
        }

        const updatedItems = [...currentItems, newItem];
        const updatedTotal = existingAccount.total + totalPrice;

        const { error: updateError } = await supabase
          .from('table_accounts')
          .update({
            items: updatedItems,
            total: updatedTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id);

        if (updateError) throw updateError;
      } else {
        // Criar nova conta
        const { error: insertError } = await supabase
          .from('table_accounts')
          .insert({
            user_id: user?.id,
            table_id: selectedTableId,
            items: [newItem],
            total: totalPrice,
            status: 'open'
          });

        if (insertError) throw insertError;

        // Atualizar status da mesa para ocupada
        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTableId);
      }

      toast({
        title: 'Produto adicionado',
        description: `${product.name} foi adicionado à mesa ${tables.find(t => t.id === selectedTableId)?.table_number}.`,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar produto à mesa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o produto à mesa.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-yellow-100 text-yellow-800';
      case 'reserved': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTableStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à Mesa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo do Produto */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium">{product?.name}</h4>
            <p className="text-sm text-muted-foreground">
              Quantidade: {quantity} | Total: R$ {totalPrice.toFixed(2)}
            </p>
            {variations && variations.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Variações: {variations.join(', ')}
              </p>
            )}
            {notes && (
              <p className="text-xs text-muted-foreground mt-1">
                Obs: {notes}
              </p>
            )}
          </div>

          {/* Seleção de Mesa */}
          <div className="space-y-2">
            <Label htmlFor="table-select">Selecionar Mesa</Label>
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger id="table-select">
                <SelectValue placeholder="Selecione uma mesa" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>Mesa {table.table_number}</span>
                      <Badge className={`ml-2 ${getTableStatusColor(table.status)}`}>
                        {getTableStatusText(table.status)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tables.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mesa cadastrada. Cadastre mesas primeiro na seção "Mesas".
            </p>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddToTable}
              className="flex-1"
              disabled={loading || !selectedTableId || tables.length === 0}
            >
              {loading ? 'Adicionando...' : 'Adicionar à Mesa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductToTableModal;
