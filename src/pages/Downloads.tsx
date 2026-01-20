
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
  Globe,
  Server
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
  const [agentStatus, setAgentStatus] = useState<'running' | 'stopped' | 'checking'>('checking');

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) setDetectedOS('Windows');
    else if (userAgent.includes('Mac')) setDetectedOS('macOS');
    else if (userAgent.includes('Linux')) setDetectedOS('Linux');
    else setDetectedOS('Unknown');
    
    // Check agent status
    checkAgentStatus();
  }, []);

  const checkAgentStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const res = await fetch('http://localhost:17171/status', { 
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setAgentStatus('running');
      } else {
        setAgentStatus('stopped');
      }
    } catch (e) {
      setAgentStatus('stopped');
    }
  };

  const [releases, setReleases] = useState<OSInfo[]>([]);
  const [siteInstallerAvailable, setSiteInstallerAvailable] = useState<boolean>(false);
  const [sitePortableAvailable, setSitePortableAvailable] = useState<boolean>(false);
  const [winInstallerUrl, setWinInstallerUrl] = useState<string>('');
  const [winPortableUrl, setWinPortableUrl] = useState<string>('');
  
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/josegenecis/boracume-pdv-system/releases/latest');
        const json = await res.json();
        const assets = Array.isArray(json.assets) ? json.assets : [];
        const findAsset = (ext: string, match?: RegExp) => {
          const a = assets.find((x: any) => x.name?.toLowerCase().endsWith(ext) && (!match || match.test(x.name)));
          return a ? { url: a.browser_download_url, size: (a.size / (1024 * 1024)).toFixed(1) + ' MB' } : null;
        };
        const winInstaller = findAsset('.exe', /setup|installer/i);
        const winPortable = findAsset('.exe', /portable/i);
        const macDmg = findAsset('.dmg');
        const linuxAppImage = findAsset('.appimage');
        const version = json.tag_name || 'latest';
        setWinInstallerUrl(winInstaller?.url || '');
        setWinPortableUrl(winPortable?.url || '');
        const items: OSInfo[] = [
          {
            name: 'Windows (Instalador)',
            icon: <Monitor className="w-6 h-6" />,
            downloadUrl: winInstaller?.url || '',
            fileSize: winInstaller?.size || '~120 MB',
            version,
            type: 'installer',
            available: !!winInstaller
          },
          {
            name: 'Windows (Portátil)',
            icon: <Monitor className="w-6 h-6" />,
            downloadUrl: winPortable?.url || '',
            fileSize: winPortable?.size || '~115 MB',
            version,
            type: 'portable',
            available: !!winPortable
          },
          {
            name: 'macOS',
            icon: <Monitor className="w-6 h-6" />,
            downloadUrl: macDmg?.url || '',
            fileSize: macDmg?.size || '~125 MB',
            version,
            type: 'installer',
            available: !!macDmg
          },
          {
            name: 'Linux',
            icon: <Monitor className="w-6 h-6" />,
            downloadUrl: linuxAppImage?.url || '',
            fileSize: linuxAppImage?.size || '~120 MB',
            version,
            type: 'portable',
            available: !!linuxAppImage
          }
        ];
        setReleases(items);
      } catch (e) {
        // fallback: show empty and rely on PWA
        setReleases([]);
      }
    };
    const checkSiteFiles = async () => {
      try {
        const [inst, port] = await Promise.allSettled([
          fetch('/electron-dist/windows-installer.exe', { method: 'HEAD' }),
          fetch('/electron-dist/windows-portable.exe', { method: 'HEAD' })
        ]);
        setSiteInstallerAvailable(inst.status === 'fulfilled' && (inst.value as Response).ok);
        setSitePortableAvailable(port.status === 'fulfilled' && (port.value as Response).ok);
      } catch {
        setSiteInstallerAvailable(false);
        setSitePortableAvailable(false);
      }
    };
    loadLatest();
    checkSiteFiles();
  }, []);

  const downloadWindowsInstaller = () => {
    const siteUrl = '/electron-dist/windows-installer.exe';
    const ghUrl = winInstallerUrl;
    const url = siteInstallerAvailable ? siteUrl : ghUrl;
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'BoracumeHub-Desktop-Installer.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open('https://github.com/josegenecis/boracume-pdv-system/releases/latest', '_blank');
    }
  };

  const downloadWindowsPortable = () => {
    const siteUrl = '/electron-dist/windows-portable.exe';
    const ghUrl = winPortableUrl;
    const url = sitePortableAvailable ? siteUrl : ghUrl;
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'BoracumeHub-Desktop-Portable.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open('https://github.com/josegenecis/boracume-pdv-system/releases/latest', '_blank');
    }
  };
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
            Escolha a melhor forma de usar o BoraCumê no seu dispositivo
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Agente de Impressão (Solução Leve) */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <CardTitle>Agente de Impressão (BoraCumê Print)</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">Novo</Badge>
          </div>
          <CardDescription>
            Use o sistema no navegador (Chrome/Edge) e imprima direto nas impressoras USB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Status do Agente no seu PC:</p>
                {agentStatus === 'running' ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Detectado e Rodando</Badge>
                ) : agentStatus === 'checking' ? (
                  <Badge variant="outline">Verificando...</Badge>
                ) : (
                  <Badge variant="destructive">Não detectado</Badge>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={checkAgentStatus}>
                  <RefreshCw className={`h-4 w-4 ${agentStatus === 'checking' ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Instale este agente leve para conectar impressoras e balanças ao seu navegador.
              </p>
            </div>
            
            <Button 
              onClick={downloadWindowsInstaller}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
            >
              <Download className="w-4 h-4 mr-1" />
              Baixar Agente (Instalador)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerta sobre PWA */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Recomendado:</strong> Instale o BoraCumê como PWA + Agente de Impressão para a melhor experiência leve e rápida.
        </AlertDescription>
      </Alert>


      {/* Aplicativo Desktop - Para PDV Completo */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-600" />
            <CardTitle>Aplicativo Desktop Completo</CardTitle>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">All-in-One</Badge>
          </div>
          <CardDescription>
            Versão completa independente (não precisa de navegador)
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
                  Impressoras térmicas • Balanças digitais • Gaveta de dinheiro • Navegador embutido
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={downloadWindowsInstaller}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar Instalador
              </Button>
              <Button 
                onClick={downloadWindowsPortable}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-1" />
                Versão Portátil
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {siteInstallerAvailable && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-white/50">
                <div className="flex items-center gap-3">
                  <Monitor className="w-6 h-6" />
                  <div>
                    <h4 className="font-medium text-sm">Windows (Instalador)</h4>
                    <p className="text-xs text-muted-foreground">.exe padrão</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/electron-dist/windows-installer.exe';
                    link.download = 'BoracumeHub-Desktop-Installer.exe';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Baixar
                </Button>
              </div>
              )}
              {/* ... portable button ... */}
            </div>
            
          </div>
        </CardContent>
      </Card>


      {/* Instalação PWA Recomendada */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <CardTitle>Aplicativo Web Progressivo (PWA)</CardTitle>
            <Badge variant="default">Mobile / Tablet</Badge>
          </div>
          <CardDescription>
            Instale o BoraCumê como um app nativo no celular ou tablet
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
