import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if app is already installed/running as PWA
    const checkInstallStatus = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode || isIOSStandalone);
    };

    checkInstallStatus();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast({
        title: "App Instalado!",
        description: "BoraCumê foi instalado com sucesso no seu dispositivo.",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Show manual installation instructions for iOS
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        toast({
          title: "Instalar no iOS",
          description: "Toque no ícone de compartilhar e selecione 'Adicionar à Tela Inicial'",
        });
        return;
      }

      // Show manual installation instructions for other browsers
      if (/Chrome/.test(navigator.userAgent)) {
        toast({
          title: "Instalar no Chrome",
          description: "Clique nos 3 pontos → 'Instalar BoraCumê' ou procure o ícone de instalação na barra de endereços",
        });
        return;
      }

      if (/Edge/.test(navigator.userAgent)) {
        toast({
          title: "Instalar no Edge", 
          description: "Clique nos 3 pontos → 'Aplicativos' → 'Instalar este site como um aplicativo'",
        });
        return;
      }
      
      toast({
        title: "Instalação Manual",
        description: "Procure pela opção 'Instalar' ou 'Adicionar à tela inicial' no menu do seu navegador.",
      });
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast({
          title: "Instalação iniciada",
          description: "O app está sendo instalado...",
        });
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
      toast({
        title: "Erro na instalação",
        description: "Não foi possível instalar o app. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const getDeviceIcon = () => {
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const getInstallText = () => {
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return "Instalar App";
    }
    return "Instalar no Desktop";
  };

  // Don't show if already running as PWA
  if (isStandalone || isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {getDeviceIcon()}
        <span>App Instalado</span>
      </div>
    );
  }

  // Show install button if prompt is available or on iOS, or fallback
  if (deferredPrompt || /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return (
      <Button onClick={handleInstallClick} className="flex items-center gap-2">
        <Download className="w-4 h-4" />
        {getInstallText()}
      </Button>
    );
  }

  // Fallback button for browsers that don't support auto-prompt
  return (
    <Button onClick={handleInstallClick} variant="outline" className="flex items-center gap-2">
      <Download className="w-4 h-4" />
      Instalar App
    </Button>
  );
};

export default PWAInstallButton;