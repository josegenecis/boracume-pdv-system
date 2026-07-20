import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';

type Coordinates = { latitude: number; longitude: number };

interface DeliveryGoogleMapProps {
  driver: Coordinates;
  destination?: Coordinates | null;
}

function createMarkerContent(color: string, label: 'Motoboy' | 'Destino') {
  const marker = document.createElement('div');
  marker.setAttribute('aria-label', label);
  marker.style.cssText = `width:42px;height:42px;display:grid;place-items:center;border:4px solid white;border-radius:999px;background:${color};color:white;font:800 18px/1 system-ui,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.28);`;
  marker.textContent = label === 'Motoboy' ? 'M' : '🏠';
  return marker;
}

export function DeliveryGoogleMap({ driver, destination }: DeliveryGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destinationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const initialDriverRef = useRef(driver);
  const initialDestinationRef = useRef(destination);
  const [error, setError] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY;
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      if (!apiKey) setError('Google Maps ainda não está configurado para o rastreamento.');
      return;
    }

    let disposed = false;
    const initialize = async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (disposed || !containerRef.current) return;
        const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
        if (disposed || !containerRef.current) return;

        const initialDriver = initialDriverRef.current;
        const initialDestination = initialDestinationRef.current;
        const driverPosition = { lat: Number(initialDriver.latitude), lng: Number(initialDriver.longitude) };
        const map = new Map(containerRef.current, {
          center: driverPosition,
          zoom: initialDestination ? 14 : 16,
          mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: 'cooperative',
        });
        mapRef.current = map;
        driverMarkerRef.current = new AdvancedMarkerElement({
          map,
          position: driverPosition,
          title: 'Localização atual do motoboy',
          content: createMarkerContent('#08704d', 'Motoboy'),
        });

        if (initialDestination) {
          const destinationPosition = { lat: Number(initialDestination.latitude), lng: Number(initialDestination.longitude) };
          destinationMarkerRef.current = new AdvancedMarkerElement({
            map,
            position: destinationPosition,
            title: 'Local de entrega',
            content: createMarkerContent('#ff6418', 'Destino'),
          });
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(driverPosition);
          bounds.extend(destinationPosition);
          map.fitBounds(bounds, 56);
        }
      } catch (initializationError) {
        if (!disposed) setError(initializationError instanceof Error ? initializationError.message : 'Não foi possível abrir o Google Maps.');
      }
    };

    void initialize();
    return () => {
      disposed = true;
      if (driverMarkerRef.current) driverMarkerRef.current.map = null;
      if (destinationMarkerRef.current) destinationMarkerRef.current.map = null;
      driverMarkerRef.current = null;
      destinationMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, mapId]);

  useEffect(() => {
    const position = { lat: Number(driver.latitude), lng: Number(driver.longitude) };
    if (driverMarkerRef.current) driverMarkerRef.current.position = position;
    if (mapRef.current) mapRef.current.panTo(position);
  }, [driver.latitude, driver.longitude]);

  if (error) {
    return <div className="flex h-72 items-center justify-center gap-2 bg-amber-50 px-6 text-center text-sm font-semibold text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>;
  }

  return <div ref={containerRef} className="h-72 w-full bg-slate-100" aria-label="Mapa do acompanhamento da entrega" />;
}
