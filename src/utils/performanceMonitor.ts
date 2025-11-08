/**
 * Monitor de Performance Avançado
 * Detecta loops infinitos e problemas de performance automaticamente
 */

interface PerformanceAlert {
  type: 'loop_detected' | 'slow_operation' | 'memory_leak' | 'excessive_renders';
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data: any;
}

interface ComponentMetrics {
  renderCount: number;
  lastRender: number;
  avgRenderTime: number;
  totalRenderTime: number;
  slowRenders: number;
  memoryUsage: number;
}

class PerformanceMonitor {
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private alerts: PerformanceAlert[] = [];
  private isEnabled = true;
  private maxAlerts = 50;
  
  // Thresholds para detecção de problemas
  private readonly THRESHOLDS = {
    LOOP_DETECTION: {
      MAX_RENDERS_PER_SECOND: 10,
      MAX_RENDERS_PER_5_SECONDS: 25
    },
    SLOW_OPERATION: {
      RENDER_TIME_WARNING: 100, // ms
      RENDER_TIME_CRITICAL: 500 // ms
    },
    MEMORY_LEAK: {
      MEMORY_INCREASE_THRESHOLD: 10 * 1024 * 1024 // 10MB
    }
  };

  constructor() {
    // Monitorar performance a cada 5 segundos
    setInterval(() => this.analyzePerformance(), 5000);
    
    // Limpar alertas antigos a cada minuto
    setInterval(() => this.cleanupOldAlerts(), 60000);
    
    // Monitorar memória a cada 30 segundos
    setInterval(() => this.checkMemoryUsage(), 30000);
  }

  // Registrar render de componente
  trackRender(component: string, renderTime?: number): void {
    if (!this.isEnabled) return;

    const now = Date.now();
    const metrics = this.componentMetrics.get(component) || {
      renderCount: 0,
      lastRender: 0,
      avgRenderTime: 0,
      totalRenderTime: 0,
      slowRenders: 0,
      memoryUsage: 0
    };

    metrics.renderCount++;
    metrics.lastRender = now;

    if (renderTime) {
      metrics.totalRenderTime += renderTime;
      metrics.avgRenderTime = metrics.totalRenderTime / metrics.renderCount;
      
      if (renderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_CRITICAL) {
        metrics.slowRenders++;
        this.createAlert('slow_operation', component, 'critical', 
          `Render muito lento: ${renderTime}ms`, { renderTime });
      } else if (renderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_WARNING) {
        this.createAlert('slow_operation', component, 'medium', 
          `Render lento: ${renderTime}ms`, { renderTime });
      }
    }

    this.componentMetrics.set(component, metrics);
    this.detectLoops(component, metrics);
  }

  // Detectar loops infinitos
  private detectLoops(component: string, metrics: ComponentMetrics): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const fiveSecondsAgo = now - 5000;

    // Contar renders na última segunda
    const recentRenders = this.countRecentRenders(component, oneSecondAgo);
    
    if (recentRenders >= this.THRESHOLDS.LOOP_DETECTION.MAX_RENDERS_PER_SECOND) {
      this.createAlert('loop_detected', component, 'critical',
        `Loop infinito detectado: ${recentRenders} renders em 1 segundo`, 
        { recentRenders, timeWindow: '1s' });
    }

    // Contar renders nos últimos 5 segundos
    const renders5s = this.countRecentRenders(component, fiveSecondsAgo);
    
    if (renders5s >= this.THRESHOLDS.LOOP_DETECTION.MAX_RENDERS_PER_5_SECONDS) {
      this.createAlert('loop_detected', component, 'high',
        `Possível loop: ${renders5s} renders em 5 segundos`, 
        { recentRenders: renders5s, timeWindow: '5s' });
    }
  }

  // Contar renders recentes (simulado - em produção usaria timestamps reais)
  private countRecentRenders(component: string, since: number): number {
    const metrics = this.componentMetrics.get(component);
    if (!metrics) return 0;
    
    // Estimativa baseada na frequência de renders
    const timeDiff = Date.now() - metrics.lastRender;
    if (timeDiff < 1000) {
      return Math.min(metrics.renderCount, 15); // Máximo estimado
    }
    return 0;
  }

  // Criar alerta
  private createAlert(
    type: PerformanceAlert['type'], 
    component: string, 
    severity: PerformanceAlert['severity'], 
    message: string, 
    data: any
  ): void {
    const alert: PerformanceAlert = {
      type,
      component,
      severity,
      message,
      timestamp: Date.now(),
      data
    };

    this.alerts.push(alert);
    
    // Manter apenas os alertas mais recentes
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Log no console baseado na severidade
    const logLevel = severity === 'critical' ? 'error' : 
                    severity === 'high' ? 'warn' : 'log';
    
    console[logLevel](`🚨 [PERFORMANCE ${severity.toUpperCase()}] ${component}: ${message}`, data);

    // Salvar alertas críticos no localStorage
    if (severity === 'critical') {
      this.saveCriticalAlert(alert);
    }
  }

  // Analisar performance geral
  private analyzePerformance(): void {
    const totalComponents = this.componentMetrics.size;
    const slowComponents = Array.from(this.componentMetrics.entries())
      .filter(([_, metrics]) => metrics.avgRenderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_WARNING)
      .length;

    if (slowComponents > totalComponents * 0.3) { // Mais de 30% dos componentes lentos
      this.createAlert('slow_operation', 'System', 'high',
        `${slowComponents}/${totalComponents} componentes com performance ruim`, 
        { slowComponents, totalComponents });
    }

    // Log de status geral
    console.log('📊 [PERFORMANCE MONITOR]', {
      totalComponents,
      slowComponents,
      totalAlerts: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length
    });
  }

  // Verificar uso de memória
  private checkMemoryUsage(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      
      if (usedMB > 100) { // Mais de 100MB
        this.createAlert('memory_leak', 'System', 'medium',
          `Alto uso de memória: ${usedMB.toFixed(1)}MB`, 
          { usedMB, totalMB });
      }
    }
  }

  // Salvar alerta crítico
  private saveCriticalAlert(alert: PerformanceAlert): void {
    try {
      const criticalAlerts = JSON.parse(
        localStorage.getItem('boracume_critical_alerts') || '[]'
      );
      
      criticalAlerts.push(alert);
      
      // Manter apenas os últimos 10 alertas críticos
      if (criticalAlerts.length > 10) {
        criticalAlerts.splice(0, criticalAlerts.length - 10);
      }
      
      localStorage.setItem('boracume_critical_alerts', JSON.stringify(criticalAlerts));
    } catch (error) {
      console.warn('Erro ao salvar alerta crítico:', error);
    }
  }

  // Limpar alertas antigos
  private cleanupOldAlerts(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
  }

  // Obter relatório completo
  getReport(): any {
    const componentStats = Array.from(this.componentMetrics.entries()).map(([name, metrics]) => ({
      name,
      ...metrics,
      status: this.getComponentStatus(metrics)
    }));

    return {
      summary: {
        totalComponents: this.componentMetrics.size,
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
        slowComponents: componentStats.filter(c => c.status === 'slow').length
      },
      components: componentStats,
      recentAlerts: this.alerts.slice(-10),
      recommendations: this.generateRecommendations()
    };
  }

  // Determinar status do componente
  private getComponentStatus(metrics: ComponentMetrics): string {
    if (metrics.avgRenderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_CRITICAL) {
      return 'critical';
    }
    if (metrics.avgRenderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_WARNING) {
      return 'slow';
    }
    if (metrics.renderCount > 50) {
      return 'frequent';
    }
    return 'normal';
  }

  // Gerar recomendações
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      recommendations.push('Loops infinitos detectados - verificar useEffect e dependências');
    }
    
    const slowComponents = Array.from(this.componentMetrics.values())
      .filter(m => m.avgRenderTime > this.THRESHOLDS.SLOW_OPERATION.RENDER_TIME_WARNING).length;
    
    if (slowComponents > 3) {
      recommendations.push('Múltiplos componentes lentos - considerar memoização e otimização');
    }
    
    return recommendations;
  }

  // Controles públicos
  enable(): void {
    this.isEnabled = true;
    console.log('📊 Monitor de performance habilitado');
  }

  disable(): void {
    this.isEnabled = false;
    console.log('📊 Monitor de performance desabilitado');
  }

  clear(): void {
    this.componentMetrics.clear();
    this.alerts = [];
    localStorage.removeItem('boracume_critical_alerts');
    console.log('📊 Dados de performance limpos');
  }

  // Obter alertas críticos salvos
  getCriticalAlerts(): PerformanceAlert[] {
    try {
      return JSON.parse(localStorage.getItem('boracume_critical_alerts') || '[]');
    } catch {
      return [];
    }
  }
}

// Instância global
export const performanceMonitor = new PerformanceMonitor();

// Hook para tracking de renders
export const usePerformanceTracking = (componentName: string) => {
  const trackRender = (renderTime?: number) => {
    performanceMonitor.trackRender(componentName, renderTime);
  };

  return { trackRender };
};

// Expor no window para debug
if (typeof window !== 'undefined') {
  (window as any).boracumePerformance = {
    monitor: performanceMonitor,
    getReport: () => performanceMonitor.getReport(),
    getCriticalAlerts: () => performanceMonitor.getCriticalAlerts(),
    clear: () => performanceMonitor.clear(),
    enable: () => performanceMonitor.enable(),
    disable: () => performanceMonitor.disable()
  };
}