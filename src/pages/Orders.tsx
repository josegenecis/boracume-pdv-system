
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Filter } from 'lucide-react';

// Define order status type
type OrderStatus = 'delivered' | 'ready' | 'preparing' | 'pending' | 'cancelled';

// Define order type
interface Order {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: OrderStatus;
  time: string;
  date: string;
}

// Sample orders data
const sampleOrders: Order[] = [
  { 
    id: '#8765', 
    customer: 'João Silva', 
    items: 3, 
    total: 89.90, 
    status: 'delivered', 
    time: '20:45',
    date: '23/05/2025'
  },
  { 
    id: '#8764', 
    customer: 'Maria Souza', 
    items: 2, 
    total: 65.50, 
    status: 'ready', 
    time: '20:32',
    date: '23/05/2025'
  },
  { 
    id: '#8763', 
    customer: 'Carlos Oliveira', 
    items: 4, 
    total: 115.80, 
    status: 'preparing', 
    time: '20:25',
    date: '23/05/2025'
  },
  { 
    id: '#8762', 
    customer: 'Ana Santos', 
    items: 1, 
    total: 32.90, 
    status: 'pending', 
    time: '20:10',
    date: '23/05/2025'
  },
  { 
    id: '#8761', 
    customer: 'Roberto Lima', 
    items: 5, 
    total: 149.90, 
    status: 'cancelled', 
    time: '19:55',
    date: '22/05/2025'
  },
];

// Get appropriate badge color for status
const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'delivered':
      return <Badge className="bg-green-500">Entregue</Badge>;
    case 'ready':
      return <Badge className="bg-blue-500">Pronto</Badge>;
    case 'preparing':
      return <Badge className="bg-amber-500">Preparando</Badge>;
    case 'pending':
      return <Badge className="bg-purple-500">Pendente</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelado</Badge>;
    default:
      return <Badge variant="outline">Desconhecido</Badge>;
  }
};

const Orders = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  
  // Filter orders based on selected status
  const filteredOrders = statusFilter === "all" 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie seus pedidos de forma eficiente</p>
        </div>
        <Button>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Todos os Pedidos</CardTitle>
          <CardDescription>Visualize e gerencie seus pedidos recentes.</CardDescription>
          
          <div className="flex items-center space-x-2 mt-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtrar por status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="preparing">Preparando</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell>{order.time}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell>R$ {order.total.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Total de pedidos: {filteredOrders.length}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Orders;
