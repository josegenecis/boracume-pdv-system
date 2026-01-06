import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

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
  const [showHelp, setShowHelp] = useState(false);
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
        setShowHelp(true);
        return;
      }

      // Show manual installation instructions for other browsers
      if (/Chrome/.test(navigator.userAgent)) {
        setShowHelp(true);
        return;
      }

      if (/Edge/.test(navigator.userAgent)) {
        setShowHelp(true);
        return;
      }
      
      setShowHelp(true);
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

  return (
    <>
      <Button onClick={handleInstallClick} variant={deferredPrompt ? 'default' : 'outline'} className="flex items-center gap-2">
        <Download className="w-4 h-4" />
        {deferredPrompt ? getInstallText() : 'Instalar App'}
      </Button>
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Instalar como App</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Caso não apareça o diálogo automático, siga as instruções do seu navegador:</p>
            <Separator />
            <div>
              <strong>Chrome (Windows/macOS):</strong>
              <ol className="list-decimal list-inside mt-1">
                <li>Clique no ícone de instalação na barra de endereços</li>
                <li>Ou Menu ⋮ → Instalar BoraCumê</li>
              </ol>
            </div>
            <div>
              <strong>Edge (Windows/macOS):</strong>
              <ol className="list-decimal list-inside mt-1">
                <li>Menu ⋯ → Aplicativos → Instalar este site como aplicativo</li>
              </ol>
            </div>
            <div>
              <strong>iOS (Safari):</strong>
              <ol className="list-decimal list-inside mt-1">
                <li>Toque em Compartilhar</li>
                <li>Adicionar à Tela Inicial</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PWAInstallButton;
