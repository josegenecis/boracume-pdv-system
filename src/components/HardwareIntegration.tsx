import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Scale, 
  Printer, 
  Wifi, 
  Usb, 
  Bluetooth, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Download
} from 'lucide-react';

import { HardwareManager } from './HardwareManager';
import { HardwareFallbackManagerComponent } from './HardwareFallbackManager';

interface BrowserSupport {
  webSerial: boolean;
  webUSB: boolean;
  webBluetooth: boolean;
  isSecureContext: boolean;
  browserName: string;
  browserVersion: string;
}

interface HardwareIntegrationProps {
  onWeightChange?: (weight: number, unit: string) => void;
  onPrintRequest?: (text: string) => void;
}

export function HardwareIntegration({ onWeightChange, onPrintRequest }: HardwareIntegrationProps) {
  const [browserSupport, setBrowserSupport] = useState<BrowserSupport | null>(null);
  const [activeTab, setActiveTab] = useState('native');
  const [showCompatibilityInfo, setShowCompatibilityInfo] = useState(false);

  // Detecta suporte do navegador
  useEffect(() => {
    const detectBrowserSupport = () => {
      const support: BrowserSupport = {
        webSerial: 'serial' in navigator,
        webUSB: 'usb' in navigator,
        webBluetooth: 'bluetooth' in navigator,
        isSecureContext: window.isSecureContext,
        browserName: getBrowserName(),
        browserVersion: getBrowserVersion()
      };
      
      setBrowserSupport(support);
      
      // Se nenhuma API nativa estiver disponível, muda para fallback
      if (!support.webSerial && !support.webUSB && !support.webBluetooth) {
        setActiveTab('fallback');
      }
    };

    detectBrowserSupport();
  }, []);

  // Detecta nome do navegador
  const getBrowserName = (): string => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Desconhecido';
  };

  // Detecta versão do navegador
  const getBrowserVersion = (): string => {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edg|Opera)\/(\d+)/);
    return match ? match[2] : 'Desconhecida';
  };

  // Renderiza status de suporte
  const renderSupportStatus = (supported: boolean, apiName: string) => {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          {apiName === 'Web Serial API' && <Wifi className="h-4 w-4" />}
          {apiName === 'Web USB API' && <Usb className="h-4 w-4" />}
          {apiName === 'Web Bluetooth API' && <Bluetooth className="h-4 w-4" />}
          <span className="font-medium">{apiName}</span>
        </div>
        {supported ? (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />Suportado
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />Não Suportado
          </Badge>
        )}
      </div>
    );
  };

  // Renderiza informações de compatibilidade
  const renderCompatibilityInfo = () => {
    if (!browserSupport) return null;

    const recommendations = [];
    
    if (!browserSupport.isSecureContext) {
      recommendations.push({
        type: 'error',
        message: 'As APIs Web requerem contexto seguro (HTTPS). Use HTTPS ou localhost para desenvolvimento.'
      });
    }
    
    if (browserSupport.browserName === 'Firefox') {
      recommendations.push({
        type: 'warning',
        message: 'Firefox tem suporte limitado para Web Serial e Web USB. Considere usar Chrome ou Edge.'
      });
    }
    
    if (browserSupport.browserName === 'Safari') {
      recommendations.push({
        type: 'warning',
        message: 'Safari não suporta Web Serial nem Web USB. Web Bluetooth tem suporte limitado.'
      });
    }
    
    if (!browserSupport.webSerial && !browserSupport.webUSB && !browserSupport.webBluetooth) {
      recommendations.push({
        type: 'info',
        message: 'Use as soluções alternativas (WebSocket, simulação ou aplicativo nativo) para conectar dispositivos.'
      });
    }

    return (
      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <Alert key={index} variant={rec.type === 'error' ? 'destructive' : 'default'}>
            {rec.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            {rec.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
            {rec.type === 'info' && <Info className="h-4 w-4" />}
            <AlertDescription>{rec.message}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  if (!browserSupport) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Detectando suporte do navegador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações do Navegador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compatibilidade do Navegador</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompatibilityInfo(!showCompatibilityInfo)}
            >
              <Info className="h-4 w-4 mr-2" />
              {showCompatibilityInfo ? 'Ocultar' : 'Mostrar'} Detalhes
            </Button>
          </CardTitle>
          <CardDescription>
            {browserSupport.browserName} {browserSupport.browserVersion} - 
            {browserSupport.isSecureContext ? 'Contexto Seguro' : 'Contexto Inseguro'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderSupportStatus(browserSupport.webSerial, 'Web Serial API')}
            {renderSupportStatus(browserSupport.webUSB, 'Web USB API')}
            {renderSupportStatus(browserSupport.webBluetooth, 'Web Bluetooth API')}
          </div>
          
          {showCompatibilityInfo && (
            <div className="mt-4">
              {renderCompatibilityInfo()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abas de Integração */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="native" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            APIs Nativas
          </TabsTrigger>
          <TabsTrigger value="fallback" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Soluções Alternativas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="native" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Integração Nativa com Hardware
              </CardTitle>
              <CardDescription>
                Use as APIs web modernas para conectar diretamente com balanças e impressoras
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(browserSupport.webSerial || browserSupport.webUSB || browserSupport.webBluetooth) ? (
                <HardwareManager 
                  onWeightChange={onWeightChange}
                  onPrintRequest={onPrintRequest}
                />
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Seu navegador não suporta as APIs web necessárias para integração nativa. 
                    Use a aba "Soluções Alternativas" para conectar dispositivos.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fallback" className="space-y-4">
          <HardwareFallbackManagerComponent 
            onWeightChange={onWeightChange}
            onPrintRequest={onPrintRequest}
          />
        </TabsContent>
      </Tabs>

      {/* Guia de Compatibilidade */}
      <Card>
        <CardHeader>
          <CardTitle>Guia de Compatibilidade</CardTitle>
          <CardDescription>
            Informações sobre suporte em diferentes navegadores e sistemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  Chrome/Edge
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✅ Web Serial API</li>
                  <li>✅ Web USB API</li>
                  <li>✅ Web Bluetooth API</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  Firefox
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>❌ Web Serial API</li>
                  <li>❌ Web USB API</li>
                  <li>✅ Web Bluetooth API</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  Safari
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>❌ Web Serial API</li>
                  <li>❌ Web USB API</li>
                  <li>⚠️ Web Bluetooth API</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  Mobile
                </h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>❌ Web Serial API</li>
                  <li>❌ Web USB API</li>
                  <li>✅ Web Bluetooth API</li>
                </ul>
              </div>
            </div>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Recomendação:</strong> Para melhor compatibilidade, use Chrome ou Edge em desktop. 
                Para dispositivos móveis ou navegadores sem suporte, use as soluções alternativas.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}