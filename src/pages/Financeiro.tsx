
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Calendar, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  paymentMethods: { [key: string]: number };
  dailyRevenue: { date: string; revenue: number; orders: number }[];
}

const Financeiro = () => {
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    paymentMethods: {},
    dailyRevenue: []
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
      fetchFinancialData();
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

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .in('status', ['completed', 'delivered']);

      if (error) throw error;

      const completedOrders = orders || [];
      
      // Calcular métricas
      const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const totalOrders = completedOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Métodos de pagamento
      const paymentMethods: { [key: string]: number } = {};
      completedOrders.forEach(order => {
        const method = order.payment_method || 'Não informado';
        paymentMethods[method] = (paymentMethods[method] || 0) + (order.total || 0);
      });

      // Receita diária
      const dailyRevenue: { [key: string]: { revenue: number; orders: number } } = {};
      completedOrders.forEach(order => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        if (!dailyRevenue[date]) {
          dailyRevenue[date] = { revenue: 0, orders: 0 };
        }
        dailyRevenue[date].revenue += order.total || 0;
        dailyRevenue[date].orders += 1;
      });

      const dailyRevenueArray = Object.entries(dailyRevenue)
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setFinancialData({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        paymentMethods,
        dailyRevenue: dailyRevenueArray
      });

    } catch (error: any) {
      console.error('Erro ao carregar dados financeiros:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados financeiros.',
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

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Dinheiro';
      case 'card': return 'Cartão';
      case 'pix': return 'PIX';
      default: return method;
    }
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
            <DollarSign className="h-6 w-6 text-green-500" />
            <h1 className="text-2xl font-bold">Financeiro</h1>
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

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(financialData.totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {financialData.totalOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(financialData.averageOrderValue)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Métodos de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(financialData.paymentMethods).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum dado de pagamento disponível para o período selecionado.
                </p>
              ) : (
                Object.entries(financialData.paymentMethods).map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{getPaymentMethodLabel(method)}</Badge>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Receita Diária */}
        <Card>
          <CardHeader>
            <CardTitle>Receita Diária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {financialData.dailyRevenue.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum dado de receita disponível para o período selecionado.
                </p>
              ) : (
                financialData.dailyRevenue.map((day) => (
                  <div key={day.date} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">
                        {format(new Date(day.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {day.orders} pedido{day.orders !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="font-bold text-green-600">
                      {formatCurrency(day.revenue)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Financeiro;
