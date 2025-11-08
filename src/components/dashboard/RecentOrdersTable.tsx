
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Order {
  id: string;
  customer_name: string;
  items: any[];
  total: number;
  status: string;
  created_at: string;
}

interface RecentOrdersTableProps {
  orders: Order[];
}

const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({ orders }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'new': { label: 'Novo', variant: 'destructive' as const },
      'confirmed': { label: 'Confirmado', variant: 'default' as const },
      'preparing': { label: 'Preparando', variant: 'secondary' as const },
      'ready': { label: 'Pronto', variant: 'outline' as const },
      'in_delivery': { label: 'Entregando', variant: 'default' as const },
      'delivered': { label: 'Entregue', variant: 'secondary' as const },
      'cancelled': { label: 'Cancelado', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { label: status, variant: 'outline' as const };

    return <Badge variant={config.variant} className="text-xs whitespace-nowrap">{config.label}</Badge>;
  };

  const getTotalItems = (items: any[]) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  };

  if (orders.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Pedidos Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm font-medium">ID</TableHead>
                <TableHead className="text-xs sm:text-sm font-medium min-w-[120px]">Cliente</TableHead>
                <TableHead className="text-xs sm:text-sm font-medium text-center">Itens</TableHead>
                <TableHead className="text-xs sm:text-sm font-medium text-right">Total</TableHead>
                <TableHead className="text-xs sm:text-sm font-medium text-center">Status</TableHead>
                <TableHead className="text-xs sm:text-sm font-medium text-center">Horário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium text-xs sm:text-sm">
                    #{order.id.slice(-6)}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm min-w-[120px]">
                    <div className="truncate max-w-[150px]" title={order.customer_name}>
                      {order.customer_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-center">
                    {getTotalItems(order.items)}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-right font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-center">
                    {formatTime(order.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentOrdersTable;
