import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export const TOTEM_RESTAURANT_STORAGE_KEY = 'popsystem_totem_restaurant_id';

export function getSavedTotemRestaurantId() {
  try {
    return String(localStorage.getItem(TOTEM_RESTAURANT_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function useTotemPwa(restaurantId: string) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    if (restaurantId) {
      try {
        localStorage.setItem(TOTEM_RESTAURANT_STORAGE_KEY, restaurantId);
      } catch {
        // O modo privado pode bloquear localStorage; o totem segue pela URL atual.
      }
    }

    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousManifest = manifestLink?.href || '';
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = themeMeta?.content || '';
    const previousTitle = document.title;

    if (manifestLink) manifestLink.href = '/manifest-totem.json';
    if (themeMeta) themeMeta.content = '#063d2e';
    document.title = 'Totem PopSystem';

    return () => {
      if (manifestLink && previousManifest) manifestLink.href = previousManifest;
      if (themeMeta && previousTheme) themeMeta.content = previousTheme;
      document.title = previousTitle;
    };
  }, [restaurantId]);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('fullscreenchange', handleFullscreen);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('fullscreenchange', handleFullscreen);
    };
  }, []);

  useEffect(() => {
    let wakeLock: { release: () => Promise<void> } | null = null;

    const requestWakeLock = async () => {
      try {
        const wakeLockApi = (navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        }).wakeLock;
        if (wakeLockApi && document.visibilityState === 'visible') {
          wakeLock = await wakeLockApi.request('screen');
        }
      } catch {
        // Wake Lock e opcional e pode ser recusado pelo navegador ou sistema operacional.
      }
    };

    void requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      void wakeLock?.release().catch(() => {});
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return 'unavailable' as const;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
    return result.outcome;
  }, [installPrompt]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen depende de gesto/permissao; manter a interface ativa e seguro.
    }
  }, []);

  return {
    canInstall: Boolean(installPrompt),
    install,
    isInstalled,
    isOnline,
    isFullscreen,
    toggleFullscreen,
  };
}
