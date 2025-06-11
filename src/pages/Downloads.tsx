
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Printer,
  Scale,
  Wifi
} from 'lucide-react';

interface OSInfo {
  name: string;
  icon: React.ReactNode;
  downloadUrl: string;
  fileSize: string;
  version: string;
}

const Downloads = () => {
  const [detectedOS, setDetectedOS] = useState<string>('');

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) setDetectedOS('Windows');
    else if (userAgent.includes('Mac')) setDetectedOS('macOS');
    else if (userAgent.includes('Linux')) setDetectedOS('Linux');
    else setDetectedOS('Unknown');
  }, []);

  const releases: OSInfo[] = [
    {
      name: 'Windows',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: '/dist-electron/Bora Cume Hub Desktop Setup 1.0.0.exe',
      fileSize: '85 MB',
      version: '1.0.0'
    },
    {
      name: 'macOS',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: '/dist-electron/Bora Cume Hub Desktop-1.0.0.dmg',
      fileSize: '90 MB',
      version: '1.0.0'
    },
    {
      name: 'Linux',
      icon: <Monitor className="w-6 h-6" />,
      downloadUrl: '/dist-electron/Bora Cume Hub Desktop-1.0.0.AppImage',
      fileSize: '88 MB',
      version: '1.0.0'
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
    return releases.find(release => release.name === detectedOS) || releases[0];
  };

  const handleDownload = (url: string, fileName: string) => {
    // Simular download - em produção isso seria um link real para o arquivo
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <Badge variant="default">Mais Popular</Badge>
          </div>
          <CardDescription>
            Versão otimizada para {detectedOS || 'seu sistema'}
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
            <Button 
              size="lg"
              onClick={() => handleDownload(
                getRecommendedRelease().downloadUrl,
                `BoracumeHub-${getRecommendedRelease().version}-${getRecommendedRelease().name}.exe`
              )}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Agora
            </Button>
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
                      </p>
                    </div>
                    {release.name === detectedOS && (
                      <Badge variant="secondary">Recomendado</Badge>
                    )}
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => handleDownload(
                      release.downloadUrl,
                      `BoracumeHub-${release.version}-${release.name}`
                    )}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar
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
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Baixe o arquivo .exe</li>
                <li>Execute o instalador como administrador</li>
                <li>Siga as instruções do assistente de instalação</li>
                <li>Execute o aplicativo e faça login com suas credenciais</li>
              </ol>
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
