
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import PWAInstallButton from '@/components/pwa/PWAInstallButton';
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
  ExternalLink,
  Zap,
  RefreshCw,
  Globe
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
<<<<<<< HEAD
      downloadUrl: '/dist-electron/BoraCumê Desktop Setup 0.0.0.exe',
      fileSize: '~120 MB',
=======
      downloadUrl: '/electron-dist/BoracumeHub-Setup-1.0.0.exe',
      fileSize: '85 MB',
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      version: '1.0.0',
      type: 'installer',
      available: true
    },
    {
      name: 'Windows (Portátil)',
      icon: <Monitor className="w-6 h-6" />,
<<<<<<< HEAD
      downloadUrl: '/dist-electron/BoraCumê Desktop 0.0.0.exe',
      fileSize: '~115 MB',
=======
      downloadUrl: '/electron-dist/BoracumeHub-Portable-1.0.0.exe',
      fileSize: '82 MB',
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      version: '1.0.0',
      type: 'portable',
      available: true
    },
    {
      name: 'macOS',
      icon: <Monitor className="w-6 h-6" />,
<<<<<<< HEAD
      downloadUrl: '/dist-electron/BoraCumê Desktop-0.0.0.dmg',
      fileSize: '~125 MB',
      version: '1.0.0',
      type: 'installer',
      available: false
=======
      downloadUrl: '/electron-dist/BoracumeHub-1.0.0.dmg',
      fileSize: '90 MB',
      version: '1.0.0',
      type: 'installer',
      available: true
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    },
    {
      name: 'Linux',
      icon: <Monitor className="w-6 h-6" />,
<<<<<<< HEAD
      downloadUrl: '/dist-electron/BoraCumê Desktop-0.0.0.AppImage',
      fileSize: '~120 MB',
      version: '1.0.0',
      type: 'portable',
      available: false
=======
      downloadUrl: '/electron-dist/BoracumeHub-1.0.0.AppImage',
      fileSize: '88 MB',
      version: '1.0.0',
      type: 'portable',
      available: true
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    }
  ];

  const pwaFeatures = [
    {
      icon: <Zap className="w-5 h-5 text-yellow-600" />,
      title: 'Instalação Instantânea',
      description: 'Instale em segundos direto do navegador, sem downloads grandes'
    },
    {
      icon: <Globe className="w-5 h-5 text-blue-600" />,
      title: 'Funciona Offline',
      description: 'Continue trabalhando mesmo sem internet, sincroniza quando voltar online'
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-green-600" />,
      title: 'Sempre Atualizado',
      description: 'Atualizações automáticas, sempre a versão mais recente'
    },
    {
      icon: <Smartphone className="w-5 h-5 text-purple-600" />,
      title: 'Mobile e Desktop',
      description: 'Funciona perfeitamente em celular, tablet e desktop'
    },
    {
      icon: <Shield className="w-5 h-5 text-orange-600" />,
      title: 'Seguro e Rápido',
      description: 'Mesma segurança da web, com performance de app nativo'
    },
    {
      icon: <Monitor className="w-5 h-5 text-indigo-600" />,
      title: 'Experiência Nativa',
      description: 'Tela cheia, sem barras do navegador, como um app real'
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
        title: "Download indisponível",
        description: "Este download não está disponível no momento.",
        variant: "destructive"
      });
      return;
    }

    // Trigger download
    const link = document.createElement('a');
    link.href = release.downloadUrl;
    link.download = release.downloadUrl.split('/').pop() || 'BoracumeHub-Desktop.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download iniciado",
      description: `Baixando ${release.name}...`,
    });
  };

  const buildLocalApp = async () => {
    toast({
      title: "Iniciando build",
      description: "Construindo aplicativo desktop localmente...",
    });

    try {
      // Here we would typically call an API to trigger the build
      // For now, we'll simulate the build process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Build concluído",
        description: "Aplicativo desktop construído com sucesso! Verifique a pasta dist-electron/",
      });
    } catch (error) {
      toast({
        title: "Erro no build",
        description: "Não foi possível construir o aplicativo. Verifique os logs do console.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instalar App</h1>
          <p className="text-muted-foreground mt-2">
            Instale o BoraCumê como um app nativo no seu dispositivo
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Alerta sobre PWA */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Novidade:</strong> Agora você pode instalar o BoraCumê como um aplicativo nativo! 
          Funciona offline, recebe notificações e tem performance de app nativo. 
          Compatible com todos os dispositivos e navegadores modernos.
        </AlertDescription>
      </Alert>

<<<<<<< HEAD
      {/* Aplicativo Desktop - Para PDV */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-600" />
            <CardTitle>Aplicativo Desktop (PDV)</CardTitle>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">Para Estabelecimentos</Badge>
          </div>
          <CardDescription>
            Versão completa com integração de hardware para pontos de venda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Printer className="w-6 h-6 text-orange-600" />
                <Scale className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold">Funcionalidades Exclusivas</h3>
                <p className="text-sm text-muted-foreground">
                  Impressoras térmicas • Balanças digitais • Gaveta de dinheiro
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {releases.filter(release => release.available).map((release, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {release.icon}
                    <div>
                      <h4 className="font-medium text-sm">{release.name}</h4>
                      <p className="text-xs text-muted-foreground">{release.fileSize}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleDownload(release)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Baixar
                  </Button>
                </div>
              ))}
            </div>
            
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Importante:</strong> O aplicativo desktop é necessário para usar impressoras térmicas, 
                balanças digitais e outras funcionalidades de hardware do PDV.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      {/* Instalação PWA Recomendada */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <CardTitle>Aplicativo Web Progressivo (PWA)</CardTitle>
<<<<<<< HEAD
            <Badge variant="default">Recomendado para uso geral</Badge>
=======
            <Badge variant="default">Recomendado</Badge>
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
          </div>
          <CardDescription>
            Instale o BoraCumê como um app nativo - funciona em qualquer dispositivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-6 h-6" />
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Instalar App Nativo</h3>
                <p className="text-sm text-muted-foreground">
                  Instalação instantânea • Funciona offline • Sempre atualizado
                </p>
              </div>
            </div>
            <PWAInstallButton />
          </div>
        </CardContent>
      </Card>

      {/* Funcionalidades do PWA */}
      <Card>
        <CardHeader>
          <CardTitle>Por que instalar o App?</CardTitle>
          <CardDescription>
            Vantagens do aplicativo instalado vs navegador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pwaFeatures.map((feature, index) => (
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

      {/* Como Instalar */}
      <Card>
        <CardHeader>
          <CardTitle>Como Instalar o App</CardTitle>
          <CardDescription>
            Guia passo a passo para diferentes dispositivos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Chrome/Edge (Desktop)
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Clique no botão "Instalar App" acima</li>
                <li>Ou clique no ícone de instalação na barra de endereços</li>
                <li>Confirme a instalação</li>
                <li>O app será adicionado ao menu iniciar/desktop</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Android (Chrome/Firefox)
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Clique no botão "Instalar App" ou no banner de instalação</li>
                <li>Ou acesse Menu → "Adicionar à tela inicial"</li>
                <li>Confirme a instalação</li>
                <li>O app aparecerá na tela inicial como qualquer outro app</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                iOS (Safari)
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-6">
                <li>Toque no ícone de compartilhar (quadrado com seta)</li>
                <li>Selecione "Adicionar à Tela Inicial"</li>
                <li>Confirme o nome e toque em "Adicionar"</li>
                <li>O app aparecerá na tela inicial</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Suporte */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Precisa de ajuda?</strong> O aplicativo PWA funciona em todos os navegadores modernos. 
          Entre em contato com nosso suporte através das configurações se tiver dificuldades na instalação.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default Downloads;
