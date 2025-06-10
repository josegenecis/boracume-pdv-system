
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Zap, 
  Database, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Server
} from 'lucide-react';

interface PerformanceMetrics {
  pageLoadTime: number;
  databaseResponseTime: number;
  apiResponseTime: number;
  memoryUsage: number;
  networkLatency: number;
  errorRate: number;
  uptime: number;
  cacheHitRate: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    databaseResponseTime: 0,
    apiResponseTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    errorRate: 0,
    uptime: 99.9,
    cacheHitRate: 85,
  });
  
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    measurePerformance();
    const interval = setInterval(measurePerformance, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const measurePerformance = () => {
    setIsMonitoring(true);

    // Measure page load time
    const startTime = performance.now();
    
    // Simulate API call to measure response time
    const apiStart = performance.now();
    fetch('/api/health-check')
      .then(() => {
        const apiTime = performance.now() - apiStart;
        return apiTime;
      })
      .catch(() => {
        return 5000; // Fallback high response time
      })
      .then((apiTime) => {
        const pageTime = performance.now() - startTime;
        
        // Simulate other metrics (in a real app, these would come from actual monitoring)
        const newMetrics: PerformanceMetrics = {
          pageLoadTime: pageTime,
          databaseResponseTime: Math.random() * 100 + 50, // 50-150ms
          apiResponseTime: apiTime,
          memoryUsage: Math.random() * 30 + 40, // 40-70%
          networkLatency: Math.random() * 100 + 20, // 20-120ms
          errorRate: Math.random() * 2, // 0-2%
          uptime: 99.5 + Math.random() * 0.5, // 99.5-100%
          cacheHitRate: 80 + Math.random() * 20, // 80-100%
        };

        setMetrics(newMetrics);
        checkForAlerts(newMetrics);
        setIsMonitoring(false);
      });
  };

  const checkForAlerts = (currentMetrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    if (currentMetrics.pageLoadTime > 3000) {
      newAlerts.push({
        id: 'page-load-slow',
        type: 'warning',
        message: 'Tempo de carregamento da página está alto (>3s)',
        timestamp: new Date(),
      });
    }

    if (currentMetrics.databaseResponseTime > 200) {
      newAlerts.push({
        id: 'db-slow',
        type: 'warning',
        message: 'Resposta do banco de dados está lenta (>200ms)',
        timestamp: new Date(),
      });
    }

    if (currentMetrics.memoryUsage > 80) {
      newAlerts.push({
        id: 'memory-high',
        type: 'error',
        message: 'Uso de memória está alto (>80%)',
        timestamp: new Date(),
      });
    }

    if (currentMetrics.errorRate > 1) {
      newAlerts.push({
        id: 'error-rate-high',
        type: 'error',
        message: 'Taxa de erro está alta (>1%)',
        timestamp: new Date(),
      });
    }

    setAlerts(prev => [...newAlerts, ...prev.slice(0, 5)]); // Keep only last 5 alerts
  };

  const getMetricStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { color: 'text-green-600', status: 'good' };
    if (value <= thresholds.warning) return { color: 'text-yellow-600', status: 'warning' };
    return { color: 'text-red-600', status: 'error' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const performanceCards = [
    {
      title: 'Tempo de Carregamento',
      value: formatTime(metrics.pageLoadTime),
      icon: Clock,
      thresholds: { good: 1000, warning: 3000 },
      currentValue: metrics.pageLoadTime,
      description: 'Tempo para carregar a página',
    },
    {
      title: 'Resposta do Banco',
      value: formatTime(metrics.databaseResponseTime),
      icon: Database,
      thresholds: { good: 100, warning: 200 },
      currentValue: metrics.databaseResponseTime,
      description: 'Tempo de resposta do banco de dados',
    },
    {
      title: 'Resposta da API',
      value: formatTime(metrics.apiResponseTime),
      icon: Server,
      thresholds: { good: 500, warning: 1000 },
      currentValue: metrics.apiResponseTime,
      description: 'Tempo de resposta da API',
    },
    {
      title: 'Uso de Memória',
      value: `${metrics.memoryUsage.toFixed(1)}%`,
      icon: Activity,
      thresholds: { good: 50, warning: 80 },
      currentValue: metrics.memoryUsage,
      description: 'Percentual de memória utilizada',
    },
    {
      title: 'Latência de Rede',
      value: formatTime(metrics.networkLatency),
      icon: Wifi,
      thresholds: { good: 50, warning: 100 },
      currentValue: metrics.networkLatency,
      description: 'Latência da conexão de rede',
    },
    {
      title: 'Taxa de Erro',
      value: `${metrics.errorRate.toFixed(2)}%`,
      icon: AlertTriangle,
      thresholds: { good: 0.5, warning: 1 },
      currentValue: metrics.errorRate,
      description: 'Percentual de requisições com erro',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Monitor de Performance</h2>
        <div className="flex items-center gap-4">
          <Badge variant={isMonitoring ? 'default' : 'secondary'}>
            {isMonitoring ? 'Monitorando...' : 'Ativo'}
          </Badge>
          <Button onClick={measurePerformance} disabled={isMonitoring}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Atualizar Métricas
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Visão geral da saúde do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.uptime.toFixed(2)}%</div>
              <p className="text-sm text-gray-600">Uptime</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.cacheHitRate.toFixed(1)}%</div>
              <p className="text-sm text-gray-600">Taxa de Cache</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {alerts.filter(a => a.type === 'error').length}
              </div>
              <p className="text-sm text-gray-600">Alertas Críticos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performanceCards.map((card, index) => {
          const status = getMetricStatus(card.currentValue, card.thresholds);
          const CardIcon = card.icon;
          
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.status)}
                  <CardIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${status.color}`}>
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                
                {/* Progress bar for percentage metrics */}
                {card.title.includes('%') || card.title.includes('Memória') ? (
                  <Progress 
                    value={card.currentValue} 
                    className="mt-2"
                    color={status.status === 'good' ? 'green' : status.status === 'warning' ? 'yellow' : 'red'}
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Performance</CardTitle>
            <CardDescription>
              Últimos alertas do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Alert key={alert.id} variant={alert.type === 'error' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{alert.message}</span>
                    <span className="text-xs text-gray-500">
                      {alert.timestamp.toLocaleTimeString('pt-BR')}
                    </span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas de Otimização</CardTitle>
          <CardDescription>
            Sugestões para melhorar a performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Otimize imagens</p>
                <p className="text-sm text-gray-600">
                  Comprima imagens de produtos para reduzir o tempo de carregamento
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Use cache estratégico</p>
                <p className="text-sm text-gray-600">
                  Implemente cache para dados acessados frequentemente
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Monitore regularmente</p>
                <p className="text-sm text-gray-600">
                  Acompanhe as métricas diariamente para identificar problemas cedo
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;
