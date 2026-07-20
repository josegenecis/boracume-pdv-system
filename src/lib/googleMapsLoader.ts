declare global {
  interface Window {
    __boracumeGoogleMapsPromise?: Promise<void>;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__boracumeGoogleMapsPromise) return window.__boracumeGoogleMapsPromise;

  window.__boracumeGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-popsystem-google-maps]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Maps.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.popsystemGoogleMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'));
    document.head.appendChild(script);
  });

  return window.__boracumeGoogleMapsPromise;
}
