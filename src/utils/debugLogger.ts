// Sistema de debug centralizado para rastreamento de problemas de carregamento
interface DebugEvent {
  timestamp: string;
  component: string;
  event: string;
  data?: any;
  level: 'info' | 'warn' | 'error' | 'debug';
}

class DebugLogger {
  private events: DebugEvent[] = [];
  private maxEvents = 100; // Limitar para evitar memory leak
  private isEnabled = true; // Pode ser controlado via env

  constructor() {
    // Verificar se está em desenvolvimento
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                     localStorage.getItem('boracume_debug') === 'true';
    
    if (this.isEnabled) {
      console.log('🐛 [DEBUG LOGGER] Sistema de debug ativado');
      this.setupGlobalErrorHandling();
    }
  }

  private setupGlobalErrorHandling() {
    // Capturar erros não tratados
    window.addEventListener('error', (event) => {
      this.log('GLOBAL', 'unhandled_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      }, 'error');
    });

    // Capturar promises rejeitadas
    window.addEventListener('unhandledrejection', (event) => {
      this.log('GLOBAL', 'unhandled_promise_rejection', {
        reason: event.reason,
        promise: event.promise
      }, 'error');
    });
  }

  log(component: string, event: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
    if (!this.isEnabled) return;

    const debugEvent: DebugEvent = {
      timestamp: new Date().toISOString(),
      component,
      event,
      data,
      level
    };

    // Adicionar ao array de eventos
    this.events.push(debugEvent);
    
    // Limitar tamanho do array
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log no console com formatação
    const emoji = this.getEmojiForLevel(level);
    const prefix = `${emoji} [${component}]`;
    
    switch (level) {
      case 'error':
        console.error(prefix, event, data);
        break;
      case 'warn':
        console.warn(prefix, event, data);
        break;
      case 'debug':
        console.debug(prefix, event, data);
        break;
      default:
        console.log(prefix, event, data);
    }

    // Detectar possíveis loops infinitos
    this.detectInfiniteLoops(component, event);
  }

  private getEmojiForLevel(level: string): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  }

  private detectInfiniteLoops(component: string, event: string) {
    // Verificar se o mesmo evento está acontecendo muito frequentemente
    const recentEvents = this.events
      .filter(e => e.component === component && e.event === event)
      .filter(e => Date.now() - new Date(e.timestamp).getTime() < 5000); // Últimos 5 segundos

    if (recentEvents.length > 10) {
      console.error('🔄 [DEBUG LOGGER] POSSÍVEL LOOP INFINITO DETECTADO:', {
        component,
        event,
        occurrences: recentEvents.length,
        timeframe: '5 segundos'
      });
      
      // Salvar no localStorage para análise
      this.saveLoopDetection(component, event, recentEvents.length);
    }
  }

  private saveLoopDetection(component: string, event: string, count: number) {
    try {
      const loops = JSON.parse(localStorage.getItem('boracume_detected_loops') || '[]');
      loops.push({
        timestamp: new Date().toISOString(),
        component,
        event,
        count
      });
      
      // Manter apenas os últimos 10 loops detectados
      if (loops.length > 10) {
        loops.splice(0, loops.length - 10);
      }
      
      localStorage.setItem('boracume_detected_loops', JSON.stringify(loops));
    } catch (error) {
      console.warn('⚠️ [DEBUG LOGGER] Erro ao salvar detecção de loop:', error);
    }
  }

  // Métodos de conveniência para diferentes componentes
  auth(event: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
    this.log('AUTH', event, data, level);
  }

  menu(event: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
    this.log('MENU', event, data, level);
  }

  route(event: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
    this.log('ROUTE', event, data, level);
  }

  form(event: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
    this.log('FORM', event, data, level);
  }

  // Obter relatório de debug
  getDebugReport() {
    return {
      events: this.events,
      detectedLoops: this.getDetectedLoops(),
      performance: this.getPerformanceMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  private getDetectedLoops() {
    try {
      return JSON.parse(localStorage.getItem('boracume_detected_loops') || '[]');
    } catch {
      return [];
    }
  }

  private getPerformanceMetrics() {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      return {
        navigation: performance.getEntriesByType('navigation')[0],
        resources: performance.getEntriesByType('resource').length,
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null
      };
    }
    return null;
  }

  // Limpar logs
  clear() {
    this.events = [];
    localStorage.removeItem('boracume_detected_loops');
    console.log('🧹 [DEBUG LOGGER] Logs limpos');
  }

  // Exportar logs para análise
  export() {
    const report = this.getDebugReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `boracume-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📥 [DEBUG LOGGER] Relatório exportado');
  }

  // Ativar/desativar debug
  toggle(enabled?: boolean) {
    this.isEnabled = enabled !== undefined ? enabled : !this.isEnabled;
    localStorage.setItem('boracume_debug', this.isEnabled.toString());
    console.log(`🐛 [DEBUG LOGGER] Debug ${this.isEnabled ? 'ativado' : 'desativado'}`);
  }
}

// Instância singleton
export const debugLogger = new DebugLogger();

// Expor no window para debug manual
if (typeof window !== 'undefined') {
  (window as any).boracumeDebug = debugLogger;
}

// Hooks para React
export const useDebugLogger = (component: string) => {
  return {
    log: (event: string, data?: any, level?: 'info' | 'warn' | 'error' | 'debug') => 
      debugLogger.log(component, event, data, level),
    auth: debugLogger.auth,
    menu: debugLogger.menu,
    route: debugLogger.route,
    form: debugLogger.form
  };
};

export default debugLogger;