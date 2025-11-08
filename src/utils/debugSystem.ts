/**
 * Sistema de Debug Avançado para Detecção de Loops Infinitos
 * Monitora performance e identifica problemas de carregamento
 */

interface DebugEvent {
  timestamp: number;
  component: string;
  action: string;
  data?: any;
  duration?: number;
}

interface PerformanceMetrics {
  authInitCount: number;
  menuLoadCount: number;
  routeGuardCount: number;
  lastAuthInit: number;
  lastMenuLoad: number;
  lastRouteGuard: number;
  totalEvents: number;
  suspiciousPatterns: string[];
}

class DebugSystem {
  private events: DebugEvent[] = [];
  private metrics: PerformanceMetrics = {
    authInitCount: 0,
    menuLoadCount: 0,
    routeGuardCount: 0,
    lastAuthInit: 0,
    lastMenuLoad: 0,
    lastRouteGuard: 0,
    totalEvents: 0,
    suspiciousPatterns: []
  };
  private maxEvents = 100;
  private loopDetectionThreshold = 5; // Máximo de eventos similares em 5 segundos
  private isEnabled = true;

  constructor() {
    // Limpar métricas antigas no localStorage
    this.loadMetrics();
    
    // Detectar loops a cada 2 segundos
    setInterval(() => this.detectLoops(), 2000);
    
    // Log de status a cada 10 segundos
    setInterval(() => this.logStatus(), 10000);
  }

  log(component: string, action: string, data?: any): void {
    if (!this.isEnabled) return;

    const timestamp = Date.now();
    const event: DebugEvent = {
      timestamp,
      component,
      action,
      data
    };

    this.events.push(event);
    this.updateMetrics(component, action, timestamp);

    // Manter apenas os últimos eventos
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log detalhado no console
    console.log(`🔍 [DEBUG] ${component}.${action}`, {
      timestamp: new Date(timestamp).toISOString(),
      data,
      metrics: this.getQuickMetrics()
    });

    // Salvar métricas
    this.saveMetrics();
  }

  logPerformance(component: string, action: string, startTime: number, data?: any): void {
    const duration = Date.now() - startTime;
    const event: DebugEvent = {
      timestamp: Date.now(),
      component,
      action,
      data,
      duration
    };

    this.events.push(event);
    
    console.log(`⏱️ [PERFORMANCE] ${component}.${action}`, {
      duration: `${duration}ms`,
      data,
      status: duration > 3000 ? '🔴 SLOW' : duration > 1000 ? '🟡 MODERATE' : '🟢 FAST'
    });
  }

  private updateMetrics(component: string, action: string, timestamp: number): void {
    this.metrics.totalEvents++;

    switch (component) {
      case 'AuthContext':
        if (action === 'initializeAuth') {
          this.metrics.authInitCount++;
          this.metrics.lastAuthInit = timestamp;
        }
        break;
      case 'useMenuData':
        if (action === 'loadData') {
          this.metrics.menuLoadCount++;
          this.metrics.lastMenuLoad = timestamp;
        }
        break;
      case 'RouteGuard':
        if (action === 'checkAuth') {
          this.metrics.routeGuardCount++;
          this.metrics.lastRouteGuard = timestamp;
        }
        break;
    }
  }

  private detectLoops(): void {
    const now = Date.now();
    const recentEvents = this.events.filter(e => now - e.timestamp < 5000);
    
    // Detectar múltiplas inicializações do AuthContext
    const authInits = recentEvents.filter(e => 
      e.component === 'AuthContext' && e.action === 'initializeAuth'
    );
    
    if (authInits.length >= this.loopDetectionThreshold) {
      const warning = `🚨 LOOP DETECTADO: AuthContext inicializado ${authInits.length} vezes em 5 segundos`;
      console.error(warning);
      this.metrics.suspiciousPatterns.push(`${new Date().toISOString()}: ${warning}`);
    }

    // Detectar múltiplos carregamentos do menu
    const menuLoads = recentEvents.filter(e => 
      e.component === 'useMenuData' && e.action === 'loadData'
    );
    
    if (menuLoads.length >= this.loopDetectionThreshold) {
      const warning = `🚨 LOOP DETECTADO: useMenuData carregado ${menuLoads.length} vezes em 5 segundos`;
      console.error(warning);
      this.metrics.suspiciousPatterns.push(`${new Date().toISOString()}: ${warning}`);
    }

    // Detectar múltiplas verificações do RouteGuard
    const routeChecks = recentEvents.filter(e => 
      e.component === 'RouteGuard' && e.action === 'checkAuth'
    );
    
    if (routeChecks.length >= this.loopDetectionThreshold) {
      const warning = `🚨 LOOP DETECTADO: RouteGuard verificado ${routeChecks.length} vezes em 5 segundos`;
      console.error(warning);
      this.metrics.suspiciousPatterns.push(`${new Date().toISOString()}: ${warning}`);
    }
  }

  private logStatus(): void {
    console.log('📊 [DEBUG STATUS]', {
      totalEvents: this.metrics.totalEvents,
      authInits: this.metrics.authInitCount,
      menuLoads: this.metrics.menuLoadCount,
      routeGuardChecks: this.metrics.routeGuardCount,
      suspiciousPatterns: this.metrics.suspiciousPatterns.length,
      recentEvents: this.events.slice(-5).map(e => `${e.component}.${e.action}`)
    });
  }

  private getQuickMetrics() {
    return {
      authInits: this.metrics.authInitCount,
      menuLoads: this.metrics.menuLoadCount,
      routeGuardChecks: this.metrics.routeGuardCount,
      totalEvents: this.metrics.totalEvents
    };
  }

  getFullReport(): any {
    return {
      metrics: this.metrics,
      recentEvents: this.events.slice(-20),
      suspiciousPatterns: this.metrics.suspiciousPatterns,
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.authInitCount > 10) {
      recommendations.push('AuthContext sendo inicializado muitas vezes - verificar useEffect e dependências');
    }
    
    if (this.metrics.menuLoadCount > 15) {
      recommendations.push('useMenuData carregando muitas vezes - implementar cache mais eficiente');
    }
    
    if (this.metrics.routeGuardCount > 20) {
      recommendations.push('RouteGuard verificando muitas vezes - otimizar lógica de redirecionamento');
    }
    
    if (this.metrics.suspiciousPatterns.length > 0) {
      recommendations.push('Loops infinitos detectados - verificar logs de padrões suspeitos');
    }
    
    return recommendations;
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem('boracume_debug_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Não foi possível salvar métricas de debug:', error);
    }
  }

  private loadMetrics(): void {
    try {
      const saved = localStorage.getItem('boracume_debug_metrics');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Resetar contadores se for uma nova sessão (mais de 1 hora)
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - parsed.lastAuthInit > oneHour) {
          this.metrics = {
            ...this.metrics,
            authInitCount: 0,
            menuLoadCount: 0,
            routeGuardCount: 0,
            totalEvents: 0,
            suspiciousPatterns: []
          };
        } else {
          this.metrics = { ...this.metrics, ...parsed };
        }
      }
    } catch (error) {
      console.warn('Não foi possível carregar métricas de debug:', error);
    }
  }

  enable(): void {
    this.isEnabled = true;
    console.log('🔍 Sistema de debug habilitado');
  }

  disable(): void {
    this.isEnabled = false;
    console.log('🔍 Sistema de debug desabilitado');
  }

  clear(): void {
    this.events = [];
    this.metrics = {
      authInitCount: 0,
      menuLoadCount: 0,
      routeGuardCount: 0,
      lastAuthInit: 0,
      lastMenuLoad: 0,
      lastRouteGuard: 0,
      totalEvents: 0,
      suspiciousPatterns: []
    };
    localStorage.removeItem('boracume_debug_metrics');
    console.log('🔍 Dados de debug limpos');
  }
}

// Instância global do sistema de debug
export const debugSystem = new DebugSystem();

// Função helper para medir performance
export const measurePerformance = (component: string, action: string) => {
  const startTime = Date.now();
  return {
    end: (data?: any) => debugSystem.logPerformance(component, action, startTime, data)
  };
};

// Função helper para logs simples
export const debugLog = (component: string, action: string, data?: any) => {
  debugSystem.log(component, action, data);
};

// Expor no window para debug manual
declare global {
  interface Window {
    boracumeDebug?: {
      system: DebugSystem;
      getReport: () => any;
      clear: () => void;
      enable: () => void;
      disable: () => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.boracumeDebug = {
    system: debugSystem,
    getReport: () => debugSystem.getFullReport(),
    clear: () => debugSystem.clear(),
    enable: () => debugSystem.enable(),
    disable: () => debugSystem.disable(),
  };
}