
import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import { DragDropKitchenBoard } from '@/components/kitchen/DragDropKitchenBoard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: any[];
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const Kitchen = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined,
    to: Date | undefined,
  } | undefined>(undefined)

  const handleOrderUpdate = useCallback((orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
        : order
    ));
  }, []);

  const fetchOrders = async () => {
    try {
      const fromDate = dateRange?.from?.toISOString()
      const toDate = dateRange?.to?.toISOString()

      let query = supabase
        .from('kitchen_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      if (fromDate && toDate) {
        query = query.gte('created_at', fromDate).lte('created_at', toDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos da cozinha.",
        variant: "destructive"
      });
    }
  };

  const filteredOrders = orders.filter(order => {
    const statusMatch = statusFilter === 'all' || order.status === statusFilter;
    const priorityMatch = priorityFilter === 'all' || order.priority === priorityFilter;
    return statusMatch && priorityMatch;
  });

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, priorityFilter, dateRange]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cozinha</h1>
            <p className="text-muted-foreground">
              Gerencie os pedidos da cozinha
            </p>
          </div>
          
          <div className="flex gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Filtrar por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="preparing">Preparando</SelectItem>
                    <SelectItem value="ready">Prontos</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filtrar por Prioridade</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Drag & Drop Board */}
        <DragDropKitchenBoard 
          orders={filteredOrders}
          onOrderUpdate={handleOrderUpdate}
        />
        
      </div>
    </DashboardLayout>
  );
};

export default Kitchen;
