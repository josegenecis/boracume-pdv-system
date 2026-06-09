
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Download, Monitor } from 'lucide-react';

const Downloads = () => {
  const [detectedOS, setDetectedOS] = useState<string>('Unknown');
  const { toast } = useToast();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) setDetectedOS('Windows');
    else if (userAgent.includes('Mac')) setDetectedOS('macOS');
    else if (userAgent.includes('Linux')) setDetectedOS('Linux');
    else setDetectedOS('Unknown');
  }, []);

  const downloadWindowsInstaller = () => {
    if (detectedOS !== 'Windows') {
      toast({
        title: 'Download disponível apenas no Windows',
        description: 'Abra esta página em um computador Windows para instalar o PopSystem Desktop.',
        variant: 'destructive'
      });
      return;
    }
    window.location.href = '/api/desktop/latest';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">App Desktop</h1>
          <p className="text-muted-foreground mt-2">
            Baixe o instalador mais recente do PopSystem Desktop.
          </p>
        </div>
        <Badge variant={detectedOS === 'Unknown' ? 'secondary' : 'default'}>
          {detectedOS !== 'Unknown' ? `Detectado: ${detectedOS}` : 'Sistema não detectado'}
        </Badge>
      </div>

      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-600" />
            <CardTitle>PopSystem Desktop (Windows)</CardTitle>
          </div>
          <CardDescription>
            Instalador oficial com atualização automática ao abrir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={downloadWindowsInstaller} className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto">
            <Download className="w-4 h-4 mr-1" />
            Baixar instalador
          </Button>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Depois de instalar esta versão, as próximas atualizações acontecem automaticamente ao abrir o app.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default Downloads;
