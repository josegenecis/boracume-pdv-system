
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Clock, ArrowRightLeft, Printer, WalletCards, ReceiptText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateOrderStatus as updateOrderStatusRemote } from '@/utils/updateOrderStatus';
import { getOpenCashRegisterSession } from '@/utils/cashSession';

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  location?: string;
  current_order_id?: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  options?: string[];
  notes?: string;
}

interface TableOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
  payment_method?: string;
  source?: 'orders' | 'table_accounts';
}

interface TableDetailsModalProps {
  table: Table | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  availableTables: Table[];
}

const TableDetailsModal: React.FC<TableDetailsModalProps> = ({
  table,
  isOpen,
  onClose,
  onRefresh,
  availableTables
}) => {
  const [currentOrder, setCurrentOrder] = useState<TableOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTransferTable, setSelectedTransferTable] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'dinheiro'>('pix');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (table && isOpen) {
      fetchTableOrder();
    }
  }, [table, isOpen]);

  const fetchTableOrder = async () => {
    if (!table || !user) return;

    try {
      setLoading(true);
      
      // Buscar pedido ativo da mesa
      const { data: orderData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('user_id', user.id)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (orderData && orderData.length > 0) {
        const order = orderData[0];
        
        // Parse items properly
        let parsedItems: OrderItem[] = [];
        try {
          if (typeof order.items === 'string') {
            parsedItems = JSON.parse(order.items);
          } else if (Array.isArray(order.items)) {
            parsedItems = order.items as unknown as OrderItem[];
          }
        } catch (e) {
          console.error('Error parsing order items:', e);
          parsedItems = [];
        }

        setCurrentOrder({
          ...order,
          items: parsedItems,
          source: 'orders'
        });
        setPaymentMethod((order.payment_method as 'pix' | 'cartao' | 'dinheiro') || 'pix');
      } else {
        const { data: accountData, error: accountError } = await supabase
          .from('table_accounts')
          .select('*')
          .eq('table_id', table.id)
          .eq('user_id', user.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (accountError && accountError.code !== 'PGRST116') throw accountError;

        if (accountData) {
          let parsedItems: OrderItem[] = [];
          try {
            if (typeof accountData.items === 'string') {
              parsedItems = JSON.parse(accountData.items);
            } else if (Array.isArray(accountData.items)) {
              parsedItems = accountData.items as unknown as OrderItem[];
            }
          } catch (e) {
            console.error('Error parsing table account items:', e);
            parsedItems = [];
          }

          setCurrentOrder({
            id: accountData.id,
            order_number: `MESA-${table.table_number}`,
            customer_name: `Mesa ${table.table_number}`,
            customer_phone: '',
            items: parsedItems,
            total: Number(accountData.total || 0),
            status: accountData.status || 'open',
            created_at: accountData.created_at,
            payment_method: 'pendente',
            source: 'table_accounts'
          });
        } else {
          setCurrentOrder(null);
        }
        setPaymentMethod('pix');
      }
    } catch (error) {
      console.error('Erro ao carregar pedido da mesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da mesa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferTable = async () => {
    if (!table || !currentOrder || !selectedTransferTable) return;

    try {
      setLoading(true);

      const sourceTable = currentOrder.source === 'table_accounts' ? 'table_accounts' : 'orders';

      // Atualizar o pedido/conta para a nova mesa
      const { error: updateError } = await supabase
        .from(sourceTable)
        .update({ table_id: selectedTransferTable })
        .eq('id', currentOrder.id);

      if (updateError) throw updateError;

      // Atualizar status das mesas
      await Promise.all([
        supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', table.id),
        supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTransferTable)
      ]);

      toast({
        title: "Mesa transferida",
        description: `Pedido transferido da Mesa ${table.table_number} com sucesso.`,
      });

      onRefresh();
      onClose();
    } catch (error) {
      console.error('Erro ao transferir mesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível transferir a mesa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPartial = () => {
    if (!currentOrder || !table) return;

    // Criar conteúdo para impressão
    const printContent = `
      <div style="font-family: monospace; font-size: 12px; max-width: 300px;">
        <h3 style="text-align: center; margin-bottom: 10px;">COMANDA PARCIAL</h3>
        <p><strong>Mesa:</strong> ${table.table_number}</p>
        <p><strong>Pedido:</strong> ${currentOrder.order_number}</p>
        <p><strong>Cliente:</strong> ${currentOrder.customer_name}</p>
        <p><strong>Data:</strong> ${new Date(currentOrder.created_at).toLocaleString('pt-BR')}</p>
        <hr>
        <h4>ITENS:</h4>
        ${currentOrder.items.map(item => `
          <div style="margin-bottom: 8px;">
            <div><strong>${item.quantity}x ${item.product_name}</strong></div>
            ${item.options ? item.options.map(opt => `<div style="margin-left: 10px;">• ${opt}</div>`).join('') : ''}
            ${item.notes ? `<div style="margin-left: 10px; font-style: italic;">Obs: ${item.notes}</div>` : ''}
            <div style="text-align: right;">R$ ${item.subtotal.toFixed(2)}</div>
          </div>
        `).join('')}
        <hr>
        <div style="text-align: right; font-weight: bold;">
          <p>TOTAL: R$ ${currentOrder.total.toFixed(2)}</p>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast({
      title: "Impressão enviada",
      description: "Comanda parcial enviada para impressão.",
    });
  };

  const handleFinishOrder = async () => {
    if (!table || !currentOrder) return;

    try {
      setLoading(true);

      const openCashSession = await getOpenCashRegisterSession(user?.id);
      if (!openCashSession?.id) {
        toast({
          title: "Caixa fechado",
          description: "Abra o caixa antes de fechar a conta da mesa.",
          variant: "destructive"
        });
        return;
      }

      if (currentOrder.source === 'table_accounts') {
        const { error: accountUpdateError } = await supabase
          .from('table_accounts')
          .update({
            status: 'closed',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOrder.id);

        if (accountUpdateError) throw accountUpdateError;
      } else {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            payment_method: paymentMethod,
            cash_register_session_id: openCashSession.id,
            acceptance_status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOrder.id);

        if (orderUpdateError) throw orderUpdateError;

        await updateOrderStatusRemote(currentOrder.id, 'completed');
      }

      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', table.id);

      if (tableError) throw tableError;

      toast({
        title: "Conta encerrada",
        description: `Mesa ${table.table_number} fechada com pagamento em ${paymentMethod === 'cartao' ? 'cartÃ£o' : paymentMethod}.`,
      });

      onRefresh();
      onClose();
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o pedido.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'preparing':
        return 'Preparando';
      case 'ready':
        return 'Pronto';
      case 'open':
        return 'Aberta';
      default:
        return status;
    }
  };

  if (!table) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={20} />
            Mesa {table.table_number}
            {table.location && ` - ${table.location}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Carregando...</p>
          </div>
        ) : currentOrder ? (
          <div className="space-y-6">
            {/* Informações do Pedido */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Pedido {currentOrder.order_number}</CardTitle>
                  <Badge className={getStatusColor(currentOrder.status)}>
                    {getStatusLabel(currentOrder.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-medium">{currentOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Telefone</p>
                    <p className="font-medium">{currentOrder.customer_phone || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Horário</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(currentOrder.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Capacidade da Mesa</p>
                    <p className="font-medium">{table.capacity} pessoas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Itens do Pedido */}
            <Card>
              <CardHeader>
                <CardTitle>Itens do Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentOrder.items.map((item, index) => (
                    <div key={index} className="border-b pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.quantity}x {item.product_name}
                          </p>
                          {item.options && item.options.length > 0 && (
                            <div className="mt-1 ml-4">
                              {item.options.map((option, optIndex) => (
                                <p key={optIndex} className="text-sm text-gray-600">
                                  • {option}
                                </p>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-sm text-gray-600 italic mt-1 ml-4">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.price)} cada
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(currentOrder.total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Transferir Mesa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRightLeft size={16} />
                    Transferir Mesa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Select value={selectedTransferTable} onValueChange={setSelectedTransferTable}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar mesa" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTables
                          .filter(t => t.id !== table.id && t.status === 'available')
                          .map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              Mesa {t.table_number}
                              {t.location && ` - ${t.location}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleTransferTable}
                      disabled={!selectedTransferTable || loading}
                      className="w-full"
                      size="sm"
                    >
                      Transferir
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Imprimir Parcial */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Printer size={16} />
                    Imprimir
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handlePrintPartial}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Comanda Parcial
                  </Button>
                </CardContent>
              </Card>

              {/* Fechamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <WalletCards size={16} />
                    Fechar Conta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Total para receber</span>
                      <ReceiptText size={14} />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(currentOrder.total)}</div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.16em] text-slate-500">Pagamento</Label>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'pix' | 'cartao' | 'dinheiro')}
                      className="grid gap-2"
                    >
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
                        <RadioGroupItem value="pix" />
                        <span className="text-sm font-medium">PIX</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
                        <RadioGroupItem value="cartao" />
                        <span className="text-sm font-medium">CartÃ£o</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
                        <RadioGroupItem value="dinheiro" />
                        <span className="text-sm font-medium">Dinheiro</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <Button
                    onClick={handleFinishOrder}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    Receber e Fechar Mesa
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Esta mesa não possui pedidos ativos.</p>
            <Button onClick={onClose} variant="outline">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TableDetailsModal;
