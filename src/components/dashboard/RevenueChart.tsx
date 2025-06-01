
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RevenueData {
  name: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  // Encontrar os valores máximo e mínimo
  const maxRevenue = Math.max(...data.map(d => d.revenue));
  const minRevenue = Math.min(...data.map(d => d.revenue));

  // Função para gerar cor baseada no valor
  const getBarColor = (value: number) => {
    if (data.length <= 1) return '#f97316'; // cor padrão se só tem um item
    
    if (value === maxRevenue) return '#22c55e'; // verde para maior
    if (value === minRevenue) return '#ef4444'; // vermelho para menor
    
    // Calcular cor intermediária baseada na posição relativa
    const ratio = (value - minRevenue) / (maxRevenue - minRevenue);
    
    if (ratio > 0.7) return '#65a30d'; // verde claro
    if (ratio > 0.4) return '#f97316'; // laranja
    if (ratio > 0.2) return '#f59e0b'; // amarelo
    return '#f87171'; // vermelho claro
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Receita Semanal</CardTitle>
        <CardDescription>
          Total da semana: {formatCurrency(totalRevenue)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$ ${value}`}
            />
            <Tooltip 
              formatter={(value) => [formatCurrency(Number(value)), 'Receita']}
              labelStyle={{ color: '#000' }}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #ccc',
                borderRadius: '6px'
              }}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.revenue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Legenda das cores */}
        <div className="flex justify-center mt-4 space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Maior venda</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>Média</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Menor venda</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
