
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Printer,
  Scale,
  Wifi,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface OSInfo {
  name: string;
  icon: React.ReactNode;
  downloadUrl: string;
  fileSize: string;
  version: string;
  type: 'installer' | 'portable';
  available: boolean;
}

const Downloads = () => {
  const [detectedOS, setDetectedOS] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) setDetectedOS('Windows');
    else if (userAgent.includes('Mac')) setDetectedOS('macOS');
    else if (userAgent.includes('Linux')) setDetectedOS('Linux');
    else setDetectedOS('Unknown');
  }, []);

  const releases: OSInfo[] = [
    {
      name: 'Windows (Instalador)',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: 'https://github.com/seu-usuario/bora-cume-hub-desktop/releases/download/v1.0.0/BoracumeHub-Setup-1.0.0.exe',
      fileSize: '85 MB',
      version: '1.0.0',
      type: 'installer',
      available: false
    },
    {
      name: 'Windows (Portátil)',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: 'https://github.com/seu-usuario/bora-cume-hub-desktop/releases/download/v1.0.0/BoracumeHub-Portable-1.0.0.exe',
      fileSize: '82 MB',
      version: '1.0.0',
      type: 'portable',
      available: false
    },
    {
      name: 'macOS',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: 'https://github.com/seu-usuario/bora-cume-hub-desktop/releases/download/v1.0.0/BoracumeHub-1.0.0.dmg',
      fileSize: '90 MB',
      version: '1.0.0',
      type: 'installer',
      available: false
    },
    {
      name: 'Linux',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: 'https://github.com/seu-usuario/bora-cume-hub-desktop/releases/download/v1.0.0/BoracumeHub-1.0.0.AppImage',
      fileSize: '88 MB',
      version: '1.0.0',
      type: 'portable',
      available: false
    }
  ];

  const features = [
    {
      icon: <Printer className="w-5 h-5 text-green-600" />,
      title: 'Impressão Térmica',
      description: 'Conecte impressoras térmicas via USB ou Bluetooth'
    },
    {
      icon: <Scale className="w-5 h-5 text-blue-600" />,
      title: 'Balança Digital',
      description: 'Integração com balanças digitais para produtos por peso'
    },
    {
      icon: <Wifi className="w-5 h-5 text-purple-600" />,
      title: 'Sincronização',
      description: 'Sincronização automática com a plataforma web'
    },
    {
      icon: <Shield className="w-5 h-5 text-orange-600" />,
      title: 'Segurança',
      description: 'Dados criptografados e autenticação segura'
    }
  ];

  const getRecommendedRelease = () => {
    if (detectedOS === 'Windows') {
      return releases.find(release => release.name === 'Windows (Portátil)') || releases[1];
    }
    return releases.find(release => release.name === detectedOS) || releases[0];
  };

  const handleDownload = (release: OSInfo) => {
    if (!release.available) {
      toast({
        title: "Download temporariamente indisponível",
        description: "O aplicativo desktop está em desenvolvimento. Você será notificado quando estiver disponível.",
        variant: "destructive"
      });
      return;
    }

    // Para downloads reais, seria assim:
    window.open(release.downloadUrl, '_blank');
  };

  const handleBuildRequest = () => {
    toast({
      title: "Solicitação enviada",
      description: "Sua solicitação foi registrada. Você receberá um email quando o download estiver disponível.",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">App Desktop</h1>
          <p className="text-muted-foreground mt-2">
            Baixe o aplicativo desktop para recursos avançados de hardware
          </p>
        </div>
      </div>

      {/* Aviso sobre disponibilidade */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>App Desktop em Desenvolvimento:</strong> O aplicativo desktop está sendo finalizado. 
          As funcionalidades de impressão térmica e balança digital estarão disponíveis em breve.
        </AlertDescription>
      </Alert>

      {/* Alerta sobre Windows SmartScreen */}
      {detectedOS === 'Windows' && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Importante para usuários Windows:</strong> O Windows pode exibir um aviso de segurança. 
            Clique em "Mais informações" e depois "Executar mesmo assim" para prosseguir. 
            Recomendamos a versão portátil para evitar problemas de instalação.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de detecção do SO */}
      {detectedOS !== 'Unknown' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Sistema detectado: <strong>{detectedOS}</strong> - Recomendamos o download abaixo
          </AlertDescription>
        </Alert>
      )}

      {/* Download Recomendado */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            <CardTitle>Download Recomendado</CardTitle>
            <Badge variant="outline">Em Desenvolvimento</Badge>
          </div>
          <CardDescription>
            Versão otimizada para {detectedOS || 'seu sistema'}
            {getRecommendedRelease().type === 'portable' && ' (Não requer instalação)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getRecommendedRelease().icon}
              <div>
                <h3 className="font-semibold">{getRecommendedRelease().name}</h3>
                <p className="text-sm text-muted-foreground">
                  Versão {getRecommendedRelease().version} • {getRecommendedRelease().fileSize}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleBuildRequest}
              >
                Notificar quando disponível
              </Button>
              <Button 
                size="lg"
                onClick={() => handleDownload(getRecommendedRelease())}
                disabled={!getRecommendedRelease().available}
              >
                <Download className="w-4 h-4 mr-2" />
                {getRecommendedRelease().available ? 'Baixar Agora' : 'Em Breve'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funcionalidades do App Desktop */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades Exclusivas</CardTitle>
          <CardDescription>
            O que você ganha com o aplicativo desktop
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                {feature.icon}
                <div>
                  <h4 className="font-medium">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Como Construir o App */}
      <Card>
        <CardHeader>
          <CardTitle>Para Desenvolvedores</CardTitle>
          <CardDescription>
            Como construir o aplicativo desktop localmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Pré-requisitos:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Node.js 18+ instalado</li>
                <li>Git instalado</li>
                <li>Visual Studio Build Tools (Windows)</li>
                <li>Python 3.x</li>
              </ul>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Comandos:</h4>
              <div className="space-y-2 text-sm font-mono">
                <div className="bg-background p-2 rounded border">
                  git clone https://github.com/seu-usuario/bora-cume-hub
                </div>
                <div className="bg-background p-2 rounded border">
                  npm install
                </div>
                <div className="bg-background p-2 rounded border">
                  npm run build
                </div>
                <div className="bg-background p-2 rounded border">
                  node build-desktop.js
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              O executável será gerado na pasta <code className="bg-muted px-1 rounded">dist-electron/</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Todas as Versões */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Versões</CardTitle>
          <CardDescription>
            Escolha a versão específica para seu sistema operacional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {releases.map((release, index) => (
              <div key={index}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {release.icon}
                    <div>
                      <h3 className="font-medium">{release.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Versão {release.version} • {release.fileSize}
                        {release.type === 'portable' && ' • Portátil'}
                        {!release.available && ' • Em desenvolvimento'}
                      </p>
                    </div>
                    {(release.name.includes(detectedOS) || 
                      (detectedOS === 'Windows' && release.name === 'Windows (Portátil)')) && (
                      <Badge variant="secondary">Recomendado</Badge>
                    )}
                    {!release.available && (
                      <Badge variant="outline">Em Breve</Badge>
                    )}
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => handleDownload(release)}
                    disabled={!release.available}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {release.available ? 'Baixar' : 'Em Breve'}
                  </Button>
                </div>
                {index < releases.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instruções de Instalação */}
      <Card>
        <CardHeader>
          <CardTitle>Como Instalar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Windows
              </h4>
              <div className="ml-6 space-y-3">
                <div>
                  <h5 className="font-medium text-sm">Versão Portátil (Recomendada):</h5>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-1">
                    <li>Baixe o arquivo portátil (.exe)</li>
                    <li>Se aparecer aviso do Windows, clique em "Mais informações" → "Executar mesmo assim"</li>
                    <li>Execute o arquivo diretamente (não precisa instalar)</li>
                    <li>Faça login com suas credenciais</li>
                  </ol>
                </div>
                <div>
                  <h5 className="font-medium text-sm">Versão Instalador:</h5>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-1">
                    <li>Baixe o arquivo de instalação (.exe)</li>
                    <li>Execute como administrador</li>
                    <li>Siga as instruções do assistente</li>
                    <li>Execute o aplicativo e faça login</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                macOS
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Baixe o arquivo .dmg</li>
                <li>Abra o arquivo e arraste o app para a pasta Aplicativos</li>
                <li>Abra o aplicativo (pode precisar autorizar nas Preferências de Segurança)</li>
                <li>Faça login com suas credenciais</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Linux
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Baixe o arquivo .AppImage</li>
                <li>Torne o arquivo executável: <code className="bg-muted px-1 rounded">chmod +x arquivo.AppImage</code></li>
                <li>Execute o arquivo diretamente</li>
                <li>Faça login com suas credenciais</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suporte */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Precisa de ajuda?</strong> Entre em contato com nosso suporte através das configurações do sistema ou 
          acesse nossa documentação online para mais informações sobre a configuração de dispositivos.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default Downloads;
