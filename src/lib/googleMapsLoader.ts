declare global {
  interface Window {
    __boracumeGoogleMapsPromise?: Promise<void>;
  }
}

async function ensureGoogleMapsLibraries(): Promise<void> {
  const maps = window.google?.maps;
  if (!maps?.importLibrary) {
    throw new Error('A biblioteca do Google Maps ainda não está disponível.');
  }

  await maps.importLibrary('maps');
  await maps.importLibrary('marker').catch(() => undefined);

  if (!window.google?.maps?.Map || !window.google?.maps?.Polygon || !window.google?.maps?.Circle) {
    throw new Error('O Google Maps não terminou de carregar. Tente novamente.');
  }
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return ensureGoogleMapsLibraries();
  if (window.__boracumeGoogleMapsPromise) return window.__boracumeGoogleMapsPromise;

  window.__boracumeGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-popsystem-google-maps]');
    if (existingScript) {
      existingScript.addEventListener('load', () => ensureGoogleMapsLibraries().then(resolve).catch(reject), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Maps.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.popsystemGoogleMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => ensureGoogleMapsLibraries().then(resolve).catch(reject);
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__boracumeGoogleMapsPromise = undefined;
    throw error;
  });

  return window.__boracumeGoogleMapsPromise;
}
