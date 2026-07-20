import { useCallback, useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useMotoboyPwa() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousManifest = manifest?.href || '';
    const previousTheme = theme?.content || '';
    const previousTitle = document.title;
    if (manifest) manifest.href = '/manifest-motoboy.json';
    if (theme) theme.content = '#063e2d';
    document.title = 'PopSystem Motoboy';

    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const installed = () => setInstallPrompt(null);
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      if (manifest && previousManifest) manifest.href = previousManifest;
      if (theme && previousTheme) theme.content = previousTheme;
      document.title = previousTitle;
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  return { canInstall: Boolean(installPrompt), install, isOnline };
}
