
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface ReportData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  salesByDay: Array<{ date: string; sales: number; orders: number }>;
  salesByCategory: Array<{ category: string; value: number; count: number }>;
}

const Relatorios = () => {
  const [reportData, setReportData] = useState<ReportData>({
    totalSales: 0,
    totalOrders: 0,
    averageTicket: 0,
    topProducts: [],
    salesByDay: [],
    salesByCategory: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user, dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      const fromDate = dateRange.from.toISOString();
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const toDateStr = toDate.toISOString();

      // Buscar pedidos no período
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', fromDate)
        .lte('created_at', toDateStr)
        .in('status', ['delivered', 'confirmed', 'preparing', 'ready', 'in_delivery']);

      if (ordersError) throw ordersError;

      // Buscar produtos para correlacionar com os itens
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id);

      if (productsError) throw productsError;

      // Processar dados
      const totalSales = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Top produtos
      const productSales: { [key: string]: { quantity: number; revenue: number; name: string } } = {};
      
      orders?.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item: any) => {
          const product = products?.find(p => p.id === item.product_id);
          const productName = product?.name || item.product_name || 'Produto';
          
          if (!productSales[productName]) {
            productSales[productName] = { quantity: 0, revenue: 0, name: productName };
          }
          
          productSales[productName].quantity += item.quantity || 1;
          productSales[productName].revenue += item.subtotal || (item.price * item.quantity) || 0;
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Vendas por dia
      const salesByDay: { [key: string]: { sales: number; orders: number } } = {};
      orders?.forEach(order => {
        const date = format(new Date(order.created_at), 'dd/MM', { locale: ptBR });
        if (!salesByDay[date]) {
          salesByDay[date] = { sales: 0, orders: 0 };
        }
        salesByDay[date].sales += Number(order.total);
        salesByDay[date].orders += 1;
      });

      const salesByDayArray = Object.entries(salesByDay).map(([date, data]) => ({
        date,
        sales: data.sales,
        orders: data.orders
      }));

      // Vendas por categoria
      const categoryMap: { [key: string]: string } = {
        hamburgers: 'Hambúrgueres',
        pizzas: 'Pizzas',
        drinks: 'Bebidas',
        desserts: 'Sobremesas',
        appetizers: 'Petiscos',
        mains: 'Pratos Principais'
      };

      const categorySales: { [key: string]: { value: number; count: number } } = {};
      
      orders?.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item: any) => {
          const product = products?.find(p => p.id === item.product_id);
          const category = categoryMap[product?.category || ''] || 'Outros';
          
          if (!categorySales[category]) {
            categorySales[category] = { value: 0, count: 0 };
          }
          
          categorySales[category].value += item.subtotal || (item.price * item.quantity) || 0;
          categorySales[category].count += item.quantity || 1;
        });
      });

      const salesByCategory = Object.entries(categorySales).map(([category, data]) => ({
        category,
        value: data.value,
        count: data.count
      }));

      setReportData({
        totalSales,
        totalOrders,
        averageTicket,
        topProducts,
        salesByDay: salesByDayArray,
        salesByCategory
      });

    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
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

  const exportData = () => {
    const csvContent = [
      ['Produto', 'Quantidade', 'Receita'],
      ...reportData.topProducts.map(p => [p.name, p.quantity.toString(), p.revenue.toString()])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${format(dateRange.from, 'dd-MM-yyyy')}-${format(dateRange.to, 'dd-MM-yyyy')}.csv`;
    a.click();
  };

  const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b'];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        
        <div className="flex items-center gap-2">
          <Popover open={showFromCalendar} onOpenChange={setShowFromCalendar}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(dateRange.from, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({ ...prev, from: date }));
                    setShowFromCalendar(false);
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <span>até</span>
          
          <Popover open={showToCalendar} onOpenChange={setShowToCalendar}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(dateRange.to, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({ ...prev, to: date }));
                    setShowToCalendar(false);
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          
          <Button onClick={exportData} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.totalSales)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalOrders}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.averageTicket)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produtos Vendidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.topProducts.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Dia</CardTitle>
              <CardDescription>
                Receita e número de pedidos no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'sales' ? formatCurrency(Number(value)) : value,
                      name === 'sales' ? 'Receita' : 'Pedidos'
                    ]}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} />
                  <Line type="monotone" dataKey="orders" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Produtos</CardTitle>
              <CardDescription>
                Produtos mais vendidos por receita
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={reportData.topProducts.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Receita']} />
                  <Bar dataKey="revenue" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Categoria</CardTitle>
              <CardDescription>
                Distribuição de vendas por categoria de produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={reportData.salesByCategory}
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ category, value }) => `${category}: ${formatCurrency(value)}`}
                  >
                    {reportData.salesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Receita']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
