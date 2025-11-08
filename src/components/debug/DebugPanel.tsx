import React, { useState, useEffect } from 'react';
import { debugLogger } from '@/utils/debugLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bug, 
  Download, 
  Trash2, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Info,
  XCircle,
  Search
} from 'lucide-react';

interface DebugEvent {
  timestamp: string;
  component: string;
  event: string;
  data?: any;
  level: 'info' | 'warn' | 'error' | 'debug';
}

const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    // Verificar se o debug está habilitado
    const isDebugEnabled = process.env.NODE_ENV === 'development' || 
                          localStorage.getItem('boracume_debug') === 'true';
    
    if (!isDebugEnabled) return;

    // Atualizar eventos a cada segundo
    const interval = setInterval(() => {
      const report = debugLogger.getDebugReport();
      setEvents(report.events || []);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const filteredEvents = events.filter(event => {
    const matchesFilter = filter === '' || 
                         event.component.toLowerCase().includes(filter.toLowerCase()) ||
                         event.event.toLowerCase().includes(filter.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || event.level === levelFilter;
    
    return matchesFilter && matchesLevel;
  }).slice(-50); // Mostrar apenas os últimos 50 eventos

  const getEventIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'debug': return <Search className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'debug': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const handleExport = () => {
    debugLogger.export();
  };

  const handleClear = () => {
    debugLogger.clear();
    setEvents([]);
  };

  const handleToggleDebug = () => {
    debugLogger.toggle();
  };

  // Botão flutuante para mostrar/ocultar o painel
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          variant="outline"
          className="bg-white shadow-lg hover:shadow-xl"
        >
          <Bug className="w-4 h-4 mr-2" />
          Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96">
      <Card className="shadow-xl border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <Bug className="w-4 h-4 mr-2" />
              Debug Panel
            </CardTitle>
            <div className="flex gap-1">
              <Button
                onClick={handleToggleDebug}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                onClick={handleExport}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                onClick={handleClear}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => setIsVisible(false)}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                <EyeOff className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Filtrar eventos..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border rounded"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-2 py-1 text-xs border rounded"
            >
              <option value="all">Todos</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
              {filteredEvents.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">
                  Nenhum evento encontrado
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded text-xs border-l-2 border-gray-200 hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getEventIcon(event.level)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-1 py-0 ${getLevelColor(event.level)}`}
                        >
                          {event.component}
                        </Badge>
                        <span className="text-gray-500 text-xs">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      
                      <div className="font-medium text-gray-900 mb-1">
                        {event.event}
                      </div>
                      
                      {event.data && (
                        <div className="text-gray-600 text-xs font-mono bg-gray-50 p-1 rounded overflow-hidden">
                          {typeof event.data === 'object' 
                            ? JSON.stringify(event.data, null, 2).slice(0, 100) + '...'
                            : String(event.data).slice(0, 100)
                          }
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPanel;