import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
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

  // Configuração do gráfico com cores modernas
  const chartConfig = {
    revenue: {
      label: "Receita",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card className="col-span-4 overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background via-background to-muted/10">
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
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="30%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
              </filter>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="hsl(var(--primary))" floodOpacity="0.15"/>
              </filter>
            </defs>
            <CartesianGrid 
              strokeDasharray="1 4" 
              className="stroke-muted/15" 
              horizontal={true}
              vertical={false}
            />
            <XAxis 
              dataKey="name" 
              className="text-sm font-medium fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, dy: 10 }}
            />
            <YAxis
              className="text-sm font-medium fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  className="min-w-40 bg-background/95 backdrop-blur-md border border-border/50 shadow-xl rounded-xl"
                  formatter={(value) => [formatCurrency(Number(value)), 'Receita']}
                />
              } 
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fill="url(#areaGradient)"
              className="transition-all duration-500"
              filter="url(#shadow)"
              dot={{
                fill: "hsl(var(--primary))", 
                stroke: "hsl(var(--background))",
                strokeWidth: 3,
                r: 5,
                filter: "url(#glow)"
              }}
              activeDot={{
                r: 8,
                stroke: "hsl(var(--primary))",
                strokeWidth: 3,
                fill: "hsl(var(--background))",
                filter: "url(#glow)",
                className: "animate-pulse"
              }}
            />
          </AreaChart>
        </ChartContainer>
        
        {/* Indicador de performance */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-sm font-medium text-primary">Performance de vendas semanal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;