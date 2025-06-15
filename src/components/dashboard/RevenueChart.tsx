
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface RevenueData {
  name: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const maxRevenue = Math.max(...data.map(d => d.revenue));

  // Configuração do gráfico com cores modernas
  const chartConfig = {
    revenue: {
      label: "Receita",
      color: "hsl(var(--chart-1))",
    },
  };

  // Função para gerar gradiente baseado no valor
  const getBarFill = (value: number, index: number) => {
    const ratio = maxRevenue > 0 ? value / maxRevenue : 0;
    
    if (ratio > 0.8) return `url(#gradient-high-${index})`;
    if (ratio > 0.5) return `url(#gradient-medium-${index})`;
    return `url(#gradient-low-${index})`;
  };

  return (
    <Card className="col-span-4 overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Receita Semanal
            </CardTitle>
            <CardDescription className="text-base mt-1">
              Total da semana: <span className="font-semibold text-primary">{formatCurrency(totalRevenue)}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              {data.map((_, index) => (
                <React.Fragment key={index}>
                  <linearGradient id={`gradient-high-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id={`gradient-medium-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id={`gradient-low-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.5} />
                  </linearGradient>
                </React.Fragment>
              ))}
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              className="stroke-muted/30" 
              horizontal={true}
              vertical={false}
            />
            <XAxis 
              dataKey="name" 
              className="text-sm font-medium fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              className="text-sm font-medium fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => value > 0 ? `R$ ${(value / 1000).toFixed(0)}k` : 'R$ 0'}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  className="w-40 bg-background/95 backdrop-blur-sm border border-border/50 shadow-xl"
                  formatter={(value) => [formatCurrency(Number(value)), 'Receita']}
                />
              } 
            />
            <Bar 
              dataKey="revenue" 
              radius={[8, 8, 0, 0]}
              className="transition-all duration-300 hover:opacity-80"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarFill(entry.revenue, index)}
                  className="drop-shadow-sm transition-all duration-300 hover:drop-shadow-md"
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        
        {/* Legenda moderna */}
        <div className="flex justify-center mt-6 space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-700"></div>
            <span className="text-xs font-medium text-muted-foreground">Alto desempenho</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-700"></div>
            <span className="text-xs font-medium text-muted-foreground">Desempenho médio</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-700"></div>
            <span className="text-xs font-medium text-muted-foreground">Baixo desempenho</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
