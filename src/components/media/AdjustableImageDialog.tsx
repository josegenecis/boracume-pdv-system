import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RotateCcw } from 'lucide-react';

type AdjustableImageDialogProps = {
  open: boolean;
  file: File | null;
  title?: string;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const makeAdjustedImageFile = async ({
  sourceUrl,
  originalName,
  outputWidth,
  outputHeight,
  zoom,
  offsetX,
  offsetY,
}: {
  sourceUrl: string;
  originalName: string;
  outputWidth: number;
  outputHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputWidth, outputHeight);

  const baseScale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (outputWidth - drawWidth) / 2 + (offsetX / 100) * outputWidth;
  const y = (outputHeight - drawHeight) / 2 + (offsetY / 100) * outputHeight;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, x, y, drawWidth, drawHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.94));
  if (!blob) throw new Error('Não foi possível gerar a imagem ajustada.');

  const baseName = originalName.replace(/\.[^.]+$/, '') || 'imagem';
  return new File([blob], `${baseName}-ajustada.png`, { type: 'image/png' });
};

export default function AdjustableImageDialog({
  open,
  file,
  title = 'Ajustar imagem',
  aspectRatio,
  outputWidth,
  outputHeight,
  onCancel,
  onConfirm,
}: AdjustableImageDialogProps) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!file || !open) return;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const previewStyle = useMemo(() => ({
    backgroundImage: sourceUrl ? `url(${sourceUrl})` : undefined,
    backgroundSize: `${zoom * 100}% auto`,
    backgroundPosition: `${50 + offsetX}% ${50 + offsetY}%`,
  }), [sourceUrl, zoom, offsetX, offsetY]);

  const handleConfirm = async () => {
    if (!file || !sourceUrl) return;
    setProcessing(true);
    try {
      const adjustedFile = await makeAdjustedImageFile({
        sourceUrl,
        originalName: file.name,
        outputWidth,
        outputHeight,
        zoom,
        offsetX,
        offsetY,
      });
      const previewUrl = URL.createObjectURL(adjustedFile);
      onConfirm(adjustedFile, previewUrl);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !processing) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div
            className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border bg-muted shadow-inner"
            style={{ aspectRatio }}
          >
            <div
              className="h-full w-full bg-cover bg-center bg-no-repeat"
              style={previewStyle}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Zoom</Label>
              <Slider value={[zoom]} min={1} max={3} step={0.02} onValueChange={([value]) => setZoom(value)} />
            </div>
            <div className="space-y-2">
              <Label>Horizontal</Label>
              <Slider value={[offsetX]} min={-50} max={50} step={1} onValueChange={([value]) => setOffsetX(value)} />
            </div>
            <div className="space-y-2">
              <Label>Vertical</Label>
              <Slider value={[offsetY]} min={-50} max={50} step={1} onValueChange={([value]) => setOffsetY(value)} />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(1);
              setOffsetX(0);
              setOffsetY(0);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Centralizar
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={processing || !file}>
            {processing ? 'Preparando...' : 'Aplicar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
