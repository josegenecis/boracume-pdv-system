
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Calendar, ShoppingBag, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportData {
  totalOrders: number;
  totalRevenue: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  ordersByStatus: { [key: string]: number };
  ordersByHour: { hour: number; count: number }[];
  customerStats: {
    totalCustomers: number;
    returningCustomers: number;
  };
}

const Relatorios = () => {
  const [reportData, setReportData] = useState<ReportData>({
    totalOrders: 0,
    totalRevenue: 0,
    topProducts: [],
    ordersByStatus: {},
    ordersByHour: [],
    customerStats: {
      totalCustomers: 0,
      returningCustomers: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: startOfDay(addDays(new Date(), -30)),
    to: endOfDay(new Date())
  });
  const [selectedPeriod, setSelectedPeriod] = useState('30days');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user, dateRange]);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    
    switch (period) {
      case 'today':
        setDateRange({
          from: startOfDay(now),
          to: endOfDay(now)
        });
        break;
      case '7days':
        setDateRange({
          from: startOfDay(addDays(now, -6)),
          to: endOfDay(now)
        });
        break;
      case '30days':
        setDateRange({
          from: startOfDay(addDays(now, -29)),
          to: endOfDay(now)
        });
        break;
      case '90days':
        setDateRange({
          from: startOfDay(addDays(now, -89)),
          to: endOfDay(now)
        });
        break;
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      if (error) throw error;

      const allOrders = orders || [];
      
      // Métricas básicas
      const totalOrders = allOrders.length;
      const totalRevenue = allOrders
        .filter(order => ['completed', 'delivered'].includes(order.status))
        .reduce((sum, order) => sum + (order.total || 0), 0);

      // Produtos mais vendidos
      const productStats: { [key: string]: { quantity: number; revenue: number } } = {};
      
      allOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const productName = item.product_name || item.name || 'Produto sem nome';
            if (!productStats[productName]) {
              productStats[productName] = { quantity: 0, revenue: 0 };
            }
            productStats[productName].quantity += item.quantity || 1;
            if (['completed', 'delivered'].includes(order.status)) {
              productStats[productName].revenue += item.subtotal || (item.price * item.quantity) || 0;
            }
          });
        }
      });

      const topProducts = Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Pedidos por status
      const ordersByStatus: { [key: string]: number } = {};
      allOrders.forEach(order => {
        const status = order.status || 'Sem status';
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      });

      // Pedidos por hora
      const ordersByHour: { [key: number]: number } = {};
      allOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        ordersByHour[hour] = (ordersByHour[hour] || 0) + 1;
      });

      const ordersByHourArray = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: ordersByHour[hour] || 0
      }));

      // Estatísticas de clientes
      const uniqueCustomers = new Set();
      const customerOrderCount: { [key: string]: number } = {};
      
      allOrders.forEach(order => {
        const customerKey = order.customer_phone || order.customer_name || 'Anônimo';
        uniqueCustomers.add(customerKey);
        customerOrderCount[customerKey] = (customerOrderCount[customerKey] || 0) + 1;
      });

      const returningCustomers = Object.values(customerOrderCount).filter(count => count > 1).length;

      setReportData({
        totalOrders,
        totalRevenue,
        topProducts,
        ordersByStatus,
        ordersByHour: ordersByHourArray,
        customerStats: {
          totalCustomers: uniqueCustomers.size,
          returningCustomers
        }
      });

    } catch (error: any) {
      console.error('Erro ao carregar relatórios:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os relatórios.',
        variant: 'destructive',
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

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'accepted': 'Aceito',
      'preparing': 'Preparando',
      'ready': 'Pronto',
      'completed': 'Concluído',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'accepted': 'bg-blue-100 text-blue-800',
      'preparing': 'bg-orange-100 text-orange-800',
      'ready': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Relatórios</h1>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="30days">Últimos 30 dias</SelectItem>
                    <SelectItem value="90days">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(reportData.totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.customerStats.totalCustomers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Recorrentes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.customerStats.returningCustomers}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Produtos Mais Vendidos */}
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum produto vendido no período selecionado.
                  </p>
                ) : (
                  reportData.topProducts.map((product, index) => (
                    <div key={product.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}º</Badge>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.quantity} vendidos
                          </div>
                        </div>
                      </div>
                      <div className="font-bold text-green-600">
                        {formatCurrency(product.revenue)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos por Status */}
          <Card>
            <CardHeader>
              <CardTitle>Pedidos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportData.ordersByStatus).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum pedido encontrado no período selecionado.
                  </p>
                ) : (
                  Object.entries(reportData.ordersByStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(status)}>
                          {getStatusLabel(status)}
                        </Badge>
                      </div>
                      <div className="font-medium">{count} pedidos</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pedidos por Horário */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Pedidos por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
              {reportData.ordersByHour.map((hourData) => (
                <div key={hourData.hour} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">
                    {hourData.hour.toString().padStart(2, '0')}h
                  </div>
                  <div 
                    className="bg-blue-500 rounded"
                    style={{ 
                      height: `${Math.max(8, (hourData.count / Math.max(...reportData.ordersByHour.map(h => h.count))) * 60)}px` 
                    }}
                  ></div>
                  <div className="text-xs font-medium mt-1">{hourData.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;
