import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Scale, 
  Printer, 
  TestTube, 
  History, 
  Download,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

import { HardwareIntegration } from '@/components/HardwareIntegration';

interface WeightReading {
  id: string;
  weight: number;
  unit: string;
  timestamp: Date;
  source: string;
}

interface PrintJob {
  id: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'error';
}

export function HardwareTestPage() {
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [currentUnit, setCurrentUnit] = useState<string>('kg');
  const [weightHistory, setWeightHistory] = useState<WeightReading[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [testPrintContent, setTestPrintContent] = useState(
    'TESTE DE IMPRESSÃO\n' +
    '==================\n' +
    'Data: ' + new Date().toLocaleString() + '\n' +
    'Produto: Teste\n' +
    'Peso: 1.250 kg\n' +
    'Preço: R$ 15,00\n' +
    '==================\n' +
    'Obrigado pela preferência!'
  );
  const [manualWeight, setManualWeight] = useState<string>('');

  // Manipula mudança de peso da balança
  const handleWeightChange = (weight: number, unit: string) => {
    setCurrentWeight(weight);
    setCurrentUnit(unit);
    
    // Adiciona ao histórico
    const reading: WeightReading = {
      id: `reading-${Date.now()}`,
      weight,
      unit,
      timestamp: new Date(),
      source: 'hardware'
    };
    
    setWeightHistory(prev => [reading, ...prev.slice(0, 9)]); // Mantém apenas os 10 mais recentes
  };

  // Manipula solicitação de impressão
  const handlePrintRequest = (content: string) => {
    const job: PrintJob = {
      id: `print-${Date.now()}`,
      content,
      timestamp: new Date(),
      status: 'sent'
    };
    
    setPrintJobs(prev => [job, ...prev.slice(0, 9)]); // Mantém apenas os 10 mais recentes
  };

  // Simula peso manual
  const simulateManualWeight = () => {
    const weight = parseFloat(manualWeight);
    if (!isNaN(weight)) {
      handleWeightChange(weight, 'kg');
      setManualWeight('');
    }
  };

  // Testa impressão
  const testPrint = () => {
    handlePrintRequest(testPrintContent);
  };

  // Limpa histórico de peso
  const clearWeightHistory = () => {
    setWeightHistory([]);
  };

  // Limpa histórico de impressão
  const clearPrintHistory = () => {
    setPrintJobs([]);
  };

  // Gera peso aleatório
  const generateRandomWeight = () => {
    const weight = Math.round((Math.random() * 5 + 0.1) * 1000) / 1000; // 0.1 a 5.1 kg
    handleWeightChange(weight, 'kg');
  };

  // Renderiza status do peso
  const renderWeightStatus = () => {
    if (currentWeight === 0) {
      return <Badge variant="outline">Sem leitura</Badge>;
    }
    
    if (currentWeight < 0.1) {
      return <Badge variant="secondary">Muito leve</Badge>;
    }
    
    if (currentWeight > 10) {
      return <Badge variant="destructive">Muito pesado</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-500">Peso válido</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <TestTube className="h-8 w-8" />
          Teste de Integração de Hardware
        </h1>
        <p className="text-muted-foreground">
          Teste e configure a integração com balanças e impressoras
        </p>
      </div>

      {/* Status Atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status da Balança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Status da Balança
            </CardTitle>
            <CardDescription>
              Leitura atual e controles de teste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold">
                {currentWeight.toFixed(3)} {currentUnit}
              </div>
              {renderWeightStatus()}
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Peso (kg)"
                  value={manualWeight}
                  onChange={(e) => setManualWeight(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && simulateManualWeight()}
                />
                <Button onClick={simulateManualWeight} disabled={!manualWeight}>
                  Simular
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={generateRandomWeight}
                className="w-full"
              >
                Gerar Peso Aleatório
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status da Impressora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Status da Impressora
            </CardTitle>
            <CardDescription>
              Teste de impressão e configurações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="print-content">Conteúdo do Teste</Label>
                <Textarea
                  id="print-content"
                  value={testPrintContent}
                  onChange={(e) => setTestPrintContent(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              
              <Button onClick={testPrint} className="w-full">
                <Printer className="h-4 w-4 mr-2" />
                Testar Impressão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integração de Hardware */}
      <HardwareIntegration 
        onWeightChange={handleWeightChange}
        onPrintRequest={handlePrintRequest}
      />

      {/* Históricos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histórico de Peso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Peso
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearWeightHistory}
                disabled={weightHistory.length === 0}
              >
                Limpar
              </Button>
            </CardTitle>
            <CardDescription>
              Últimas 10 leituras de peso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weightHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma leitura de peso registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {weightHistory.map((reading, index) => (
                  <div 
                    key={reading.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      index === 0 ? 'bg-primary/5 border-primary/20' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium">
                        {reading.weight.toFixed(3)} {reading.unit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {reading.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <Badge variant={index === 0 ? 'default' : 'outline'}>
                      {reading.source}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Impressão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico de Impressão
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearPrintHistory}
                disabled={printJobs.length === 0}
              >
                Limpar
              </Button>
            </CardTitle>
            <CardDescription>
              Últimos 10 trabalhos de impressão
            </CardDescription>
          </CardHeader>
          <CardContent>
            {printJobs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum trabalho de impressão registrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {printJobs.map((job, index) => (
                  <div 
                    key={job.id} 
                    className={`p-3 rounded-lg border ${
                      index === 0 ? 'bg-primary/5 border-primary/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-muted-foreground">
                        {job.timestamp.toLocaleTimeString()}
                      </div>
                      <Badge 
                        variant={job.status === 'sent' ? 'default' : 
                                job.status === 'error' ? 'destructive' : 'secondary'}
                      >
                        {job.status === 'sent' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {job.status === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {job.status === 'sent' ? 'Enviado' : 
                         job.status === 'error' ? 'Erro' : 'Pendente'}
                      </Badge>
                    </div>
                    <div className="text-xs font-mono bg-muted p-2 rounded max-h-20 overflow-y-auto">
                      {job.content.split('\n').slice(0, 3).join('\n')}
                      {job.content.split('\n').length > 3 && '\n...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Instruções de Uso
          </CardTitle>
          <CardDescription>
            Como usar a integração de hardware
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>APIs Nativas:</strong> Use Chrome ou Edge para melhor suporte às APIs Web Serial, Web USB e Web Bluetooth.
                Certifique-se de que o site está sendo acessado via HTTPS ou localhost.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                <strong>Soluções Alternativas:</strong> Se as APIs nativas não estiverem disponíveis, use:
                <br />• WebSocket: Instale o servidor local para conectar balanças seriais
                <br />• Aplicativo Nativo: Instale o app desktop para acessar impressoras do sistema
                <br />• Simulação: Use para testes e demonstrações
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">Balanças Suportadas:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Toledo (Serial/USB)</li>
                  <li>• Filizola (Serial/USB)</li>
                  <li>• Urano (Serial/USB)</li>
                  <li>• Genéricas (Serial/USB)</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Impressoras Suportadas:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Epson (Bluetooth/ESC-POS)</li>
                  <li>• Bematech (Bluetooth/ESC-POS)</li>
                  <li>• Daruma (Bluetooth/ESC-POS)</li>
                  <li>• Genéricas (Bluetooth/ESC-POS)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}