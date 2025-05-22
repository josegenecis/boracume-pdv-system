
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart as BarChartIcon, 
  PieChart, 
  Download, 
  Calendar, 
  Users,
  ShoppingCart,
  MapPin,
  Tag
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const salesData = [
  { data: '01/05', vendas: 2100, pedidos: 21 },
  { data: '02/05', vendas: 2400, pedidos: 24 },
  { data: '03/05', vendas: 1800, pedidos: 18 },
  { data: '04/05', vendas: 2800, pedidos: 28 },
  { data: '05/05', vendas: 3200, pedidos: 32 },
  { data: '06/05', vendas: 3800, pedidos: 38 },
  { data: '07/05', vendas: 3100, pedidos: 31 },
  { data: '08/05', vendas: 2700, pedidos: 27 },
  { data: '09/05', vendas: 2900, pedidos: 29 },
  { data: '10/05', vendas: 3400, pedidos: 34 },
  { data: '11/05', vendas: 3200, pedidos: 32 },
  { data: '12/05', vendas: 3600, pedidos: 36 },
  { data: '13/05', vendas: 3000, pedidos: 30 },
  { data: '14/05', vendas: 2800, pedidos: 28 },
];

const paymentMethodData = [
  { name: 'PIX', value: 45 },
  { name: 'Cartão', value: 40 },
  { name: 'Dinheiro', value: 15 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const productPerformanceData = [
  { name: 'X-Burger Especial', vendas: 82, valor: 1558 },
  { name: 'Hambúrguer Artesanal', vendas: 68, valor: 1224 },
  { name: 'Batata Frita Grande', vendas: 110, valor: 990 },
  { name: 'Combo Família', vendas: 42, valor: 1680 },
  { name: 'Pizza Margherita', vendas: 55, valor: 1375 },
];

const deliveriesData = [
  { data: '01/05', entregas: 18, tempo: 25 },
  { data: '02/05', entregas: 22, tempo: 26 },
  { data: '03/05', entregas: 16, tempo: 24 },
  { data: '04/05', entregas: 25, tempo: 28 },
  { data: '05/05', entregas: 30, tempo: 27 },
  { data: '06/05', entregas: 35, tempo: 29 },
  { data: '07/05', entregas: 28, tempo: 25 },
  { data: '08/05', entregas: 24, tempo: 26 },
  { data: '09/05', entregas: 27, tempo: 25 },
  { data: '10/05', entregas: 32, tempo: 27 },
  { data: '11/05', entregas: 30, tempo: 26 },
  { data: '12/05', entregas: 34, tempo: 28 },
  { data: '13/05', entregas: 28, tempo: 27 },
  { data: '14/05', entregas: 26, tempo: 25 },
];

const customerData = [
  { mes: 'Jan', novos: 24, retorno: 45 },
  { mes: 'Fev', novos: 28, retorno: 52 },
  { mes: 'Mar', novos: 32, retorno: 61 },
  { mes: 'Abr', novos: 35, retorno: 67 },
  { mes: 'Mai', novos: 42, retorno: 72 },
];

const Relatorios = () => {
  const [dateRange, setDateRange] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null
  });
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Relatórios e Análises</h1>
      
      <div className="flex flex-wrap items-center gap-4 pb-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">De</div>
          <DatePicker
            date={dateRange.startDate}
            setDate={(date) => setDateRange({...dateRange, startDate: date})}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">Até</div>
          <DatePicker
            date={dateRange.endDate}
            setDate={(date) => setDateRange({...dateRange, endDate: date})}
          />
        </div>
        <Button className="mt-6">
          Aplicar Período
        </Button>
        <Button variant="outline" className="mt-6">
          <Download className="mr-2 h-4 w-4" />
          Exportar Dados
        </Button>
      </div>
      
      <Tabs defaultValue="vendas" className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex md:grid-cols-none gap-2">
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span>Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="entregas" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Entregas</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Clientes</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="vendas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total de Vendas</CardTitle>
                <CardDescription>Últimos 14 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ 39.900,00</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 12%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Pedidos</CardTitle>
                <CardDescription>Últimos 14 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">399</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 8%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Ticket Médio</CardTitle>
                <CardDescription>Valor médio por pedido</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ 100,00</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 4%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Taxa de Conversão</CardTitle>
                <CardDescription>Visualizações para pedidos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">18,5%</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 2%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução de Vendas</CardTitle>
                <CardDescription>Receita e número de pedidos dos últimos 14 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={salesData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="vendas" name="Vendas (R$)" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="pedidos" name="Pedidos" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Métodos de Pagamento</CardTitle>
                <CardDescription>Distribuição por forma de pagamento</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pt-4">
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="produtos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho de Produtos</CardTitle>
              <CardDescription>Produtos mais vendidos e sua receita</CardDescription>
              
              <div className="mt-4">
                <Select defaultValue="quantidade">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantidade">Quantidade Vendida</SelectItem>
                    <SelectItem value="valor">Valor Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={productPerformanceData}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 30,
                    left: 100,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="vendas" name="Quantidade" fill="#8884d8" />
                  <Bar dataKey="valor" name="Valor Total (R$)" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="entregas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total de Entregas</CardTitle>
                <CardDescription>Últimos 14 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">375</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 10%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tempo Médio</CardTitle>
                <CardDescription>Preparo + entrega</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">26 min</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↓ 2 min</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Taxa de Entrega</CardTitle>
                <CardDescription>Valor médio cobrado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ 5,90</div>
                <div className="text-sm text-muted-foreground">
                  Taxa fixa para raio de até 3km
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Desempenho de Entregas</CardTitle>
              <CardDescription>Quantidade e tempo médio de entrega</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={deliveriesData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="entregas" 
                    name="Quantidade de Entregas"
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="tempo" 
                    name="Tempo Médio (min)"
                    stroke="#82ca9d" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total de Clientes</CardTitle>
                <CardDescription>Base de clientes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">358</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 15%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Novos Clientes</CardTitle>
                <CardDescription>Últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">42</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 8%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Taxa de Retenção</CardTitle>
                <CardDescription>Últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">78%</div>
                <div className="text-sm text-muted-foreground">
                  <span className="text-green-500 font-medium">↑ 3%</span> comparado ao período anterior
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Evolução da Base de Clientes</CardTitle>
              <CardDescription>Novos clientes vs. clientes retornando</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={customerData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="novos" name="Novos Clientes" stackId="a" fill="#8884d8" />
                  <Bar dataKey="retorno" name="Clientes Retornando" stackId="a" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
