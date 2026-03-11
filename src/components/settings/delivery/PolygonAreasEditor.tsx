import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polygon, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Undo2 } from 'lucide-react'

export type PolygonPoint = { lat: number; lng: number }

export type PolygonAreaDraft = {
  id: string
  name: string
  delivery_fee: string
  minimum_order: string
  delivery_time: string
  active: boolean
  points: PolygonPoint[]
}

function makeId() {
  try {
    const c = crypto as unknown as { randomUUID?: () => string }
    if (typeof c?.randomUUID === 'function') return c.randomUUID()
  } catch {}
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2)
}

function MapClickAdder(props: { enabled: boolean; onAdd: (p: PolygonPoint) => void }) {
  useMapEvents({
    click: (e) => {
      if (!props.enabled) return
      props.onAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

function LeafletAutoResize() {
  const map = useMap()
  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 50)
    const t2 = window.setTimeout(() => map.invalidateSize(), 250)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize()
          })
        : null
    try {
      const el = map.getContainer()
      ro?.observe(el)
      if (el.parentElement) ro?.observe(el.parentElement)
    } catch {}
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [map])
  return null
}

declare global {
  interface Window {
    __boracumeGoogleMapsPromise?: Promise<void>
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__boracumeGoogleMapsPromise) return window.__boracumeGoogleMapsPromise

  window.__boracumeGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.defer = true
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar Google Maps'))
    document.head.appendChild(s)
  })

  return window.__boracumeGoogleMapsPromise
}

function GooglePolygonMap(props: {
  center: { lat: number; lng: number }
  enabled: boolean
  points: PolygonPoint[]
  onAddPoint: (p: PolygonPoint) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polygonRef = useRef<google.maps.Polygon | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const enabledRef = useRef<boolean>(props.enabled)
  enabledRef.current = props.enabled

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return
    if (!window.google?.maps) return

    mapRef.current = new window.google.maps.Map(containerRef.current, {
      center: props.center,
      zoom: 14,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      streetViewControl: false,
      fullscreenControl: false
    })

    polygonRef.current = new window.google.maps.Polygon({
      paths: [],
      strokeColor: '#f97316',
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: '#f97316',
      fillOpacity: 0.15
    })
    polygonRef.current.setMap(mapRef.current)

    mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!enabledRef.current) return
      const lat = e.latLng?.lat()
      const lng = e.latLng?.lng()
      if (typeof lat !== 'number' || typeof lng !== 'number') return
      props.onAddPoint({ lat, lng })
    })
  }, [props.center, props.enabled, props.onAddPoint])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setCenter(props.center)
  }, [props.center])

  useEffect(() => {
    if (!mapRef.current) return
    const g = window.google
    if (!g?.maps) return
    const t1 = window.setTimeout(() => {
      g.maps.event.trigger(mapRef.current!, 'resize')
      mapRef.current!.setCenter(props.center)
    }, 50)
    const t2 = window.setTimeout(() => {
      g.maps.event.trigger(mapRef.current!, 'resize')
      mapRef.current!.setCenter(props.center)
    }, 250)
    const ro =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => {
            g.maps.event.trigger(mapRef.current!, 'resize')
            mapRef.current!.setCenter(props.center)
          })
        : null
    if (ro && containerRef.current) ro.observe(containerRef.current)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      ro?.disconnect()
    }
  }, [props.center, props.enabled])

  useEffect(() => {
    if (!mapRef.current || !polygonRef.current) return

    const g = window.google
    if (!g?.maps) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const path = props.points.map((p) => new g.maps.LatLng(p.lat, p.lng))
    polygonRef.current.setPaths(path)

    markersRef.current = props.points.map(
      (p) =>
        new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: mapRef.current!,
          clickable: false
        })
    )
  }, [props.points])

  return <div ref={containerRef} className="h-[360px] w-full" />
}

export default function PolygonAreasEditor(props: {
  storeLocation: { lat: number; lng: number } | null
  areas: PolygonAreaDraft[]
  setAreas: React.Dispatch<React.SetStateAction<PolygonAreaDraft[]>>
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}) {
  const selected = useMemo(() => props.areas.find((a) => a.id === props.selectedId) || null, [props.areas, props.selectedId])
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY
  const [googleReady, setGoogleReady] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [osmTileError, setOsmTileError] = useState(false)

  const center = useMemo(() => {
    if (selected?.points?.length) return [selected.points[0].lat, selected.points[0].lng] as [number, number]
    if (props.storeLocation) return [props.storeLocation.lat, props.storeLocation.lng] as [number, number]
    return [-15.793889, -47.882778] as [number, number]
  }, [selected, props.storeLocation])

  const polygonPositions = useMemo(() => {
    if (!selected || selected.points.length < 3) return null
    return selected.points.map((p) => [p.lat, p.lng] as [number, number])
  }, [selected])

  const addArea = () => {
    const id = makeId()
    props.setAreas((prev) => [
      ...prev,
      {
        id,
        name: 'Nova área',
        delivery_fee: '0',
        minimum_order: '0',
        delivery_time: '30-45 min',
        active: true,
        points: []
      }
    ])
    props.setSelectedId(id)
  }

  const removeArea = (id: string) => {
    props.setAreas((prev) => prev.filter((a) => a.id !== id))
    if (props.selectedId === id) props.setSelectedId(null)
  }

  const updateSelected = (patch: Partial<PolygonAreaDraft>) => {
    if (!props.selectedId) return
    props.setAreas((prev) => prev.map((a) => (a.id === props.selectedId ? { ...a, ...patch } : a)))
  }

  const addPoint = (p: PolygonPoint) => {
    if (!selected) return
    updateSelected({ points: [...selected.points, p] })
  }

  const undoPoint = () => {
    if (!selected) return
    updateSelected({ points: selected.points.slice(0, -1) })
  }

  const clearPoints = () => {
    if (!selected) return
    updateSelected({ points: [] })
  }

  useEffect(() => {
    if (!googleKey) {
      setGoogleReady(false)
      setGoogleError(null)
      return
    }
    let cancelled = false
    ;(window as any).gm_authFailure = () => {
      if (cancelled) return
      setGoogleReady(false)
      setGoogleError('Falha na autenticação do Google Maps (verifique chave/restrições/billing).')
    }
    loadGoogleMaps(googleKey)
      .then(() => {
        if (cancelled) return
        setGoogleReady(true)
        setGoogleError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setGoogleReady(false)
        setGoogleError(String(e?.message || 'Erro ao carregar Google Maps'))
      })
    return () => {
      cancelled = true
      try {
        if ((window as any).gm_authFailure) delete (window as any).gm_authFailure
      } catch {}
    }
  }, [googleKey])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b text-xs text-muted-foreground flex items-center justify-between gap-2">
          <div className="min-w-0 truncate">
            {googleKey ? (googleReady ? 'Mapa: Google Maps' : 'Mapa: carregando Google Maps') : 'Mapa: OpenStreetMap (fallback)'}
          </div>
          {!googleKey && (
            <div className="shrink-0">
              Defina VITE_GOOGLE_MAPS_BROWSER_API_KEY e faça redeploy
            </div>
          )}
        {osmTileError && (
          <div className="shrink-0 text-destructive">
            Sem tiles do mapa (rede/bloqueio). Tente liberar tile.openstreetmap.org
          </div>
        )}
        </div>
        {googleKey ? (
          googleReady ? (
            <GooglePolygonMap
              center={{ lat: center[0], lng: center[1] }}
              enabled={!!selected}
              points={selected?.points || []}
              onAddPoint={addPoint}
            />
          ) : (
            <div className="h-[360px] w-full flex items-center justify-center text-sm text-muted-foreground">
              {googleError ? googleError : 'Carregando Google Maps...'}
            </div>
          )
        ) : (
          <div className="h-[360px]">
            <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{
                  tileerror: () => setOsmTileError(true),
                  load: () => setOsmTileError(false)
                }}
              />
              <LeafletAutoResize />
              <MapClickAdder enabled={!!selected} onAdd={addPoint} />
              {selected?.points?.map((p, idx) => (
                <CircleMarker key={idx} center={[p.lat, p.lng]} radius={5} pathOptions={{ color: '#f97316' }} />
              ))}
              {polygonPositions && <Polygon positions={polygonPositions} pathOptions={{ color: '#f97316' }} />}
            </MapContainer>
          </div>
        )}
        <div className="p-3 border-t flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={undoPoint} disabled={!selected || selected.points.length === 0}>
            <Undo2 size={16} className="mr-2" />
            Desfazer ponto
          </Button>
          <Button type="button" variant="outline" onClick={clearPoints} disabled={!selected || selected.points.length === 0}>
            Limpar
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Áreas</div>
            <div className="text-xs text-muted-foreground">Clique no mapa para desenhar</div>
          </div>
          <Button type="button" variant="outline" onClick={addArea}>
            <Plus size={16} className="mr-2" />
            Adicionar área
          </Button>
        </div>

        <div className="space-y-2">
          {props.areas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma área cadastrada.</div>
          ) : (
            props.areas.map((a) => (
              <div key={a.id} className={`p-3 border rounded-lg ${props.selectedId === a.id ? 'border-boracume-orange bg-boracume-orange/5' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="text-left min-w-0" onClick={() => props.setSelectedId(a.id)}>
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.points.length} pontos • R$ {Number(a.delivery_fee || 0).toFixed(2)}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => props.setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)))}>
                      {a.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeArea(a.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div className="p-3 border rounded-lg space-y-3">
            <div className="space-y-2">
              <Label>Nome da área</Label>
              <Input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Taxa (R$)</Label>
                <Input type="number" step="0.01" value={selected.delivery_fee} onChange={(e) => updateSelected({ delivery_fee: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Mínimo (R$)</Label>
                <Input type="number" step="0.01" value={selected.minimum_order} onChange={(e) => updateSelected({ minimum_order: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tempo</Label>
              <Input value={selected.delivery_time} onChange={(e) => updateSelected({ delivery_time: e.target.value })} />
            </div>
            <div className="text-xs text-muted-foreground">
              Área selecionada: clique no mapa para adicionar pontos (mínimo 3).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

