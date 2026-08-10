import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Loader2 } from 'lucide-react';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onDetected: (code: string) => void };

export default function BarcodeCameraScanner({ open, onOpenChange, onDetected }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const [error, setError] = React.useState('');
  const [starting, setStarting] = React.useState(false);

  const stop = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!open) { stop(); return; }
    let active = true;
    const start = async () => {
      setStarting(true);
      setError('');
      try {
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) throw new Error('A leitura por câmera não é suportada neste navegador. Use Chrome/Edge atualizado ou o leitor USB.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
        const detect = async () => {
          if (!active || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const code = String(results?.[0]?.rawValue || '').trim();
            if (code) { onDetected(code); onOpenChange(false); return; }
          } catch {}
          timerRef.current = window.setTimeout(detect, 180);
        };
        void detect();
      } catch (cause: any) {
        setError(cause?.message || 'Não foi possível abrir a câmera.');
      } finally { if (active) setStarting(false); }
    };
    void start();
    return () => { active = false; stop(); };
  }, [open, onDetected, onOpenChange, stop]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Ler código pela câmera</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
        </div>
        {starting && <div className="flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo câmera…</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}
