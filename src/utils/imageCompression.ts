export type CompressImageOptions = {
  maxBytes: number;
  maxDimension?: number;
  preferMimeType?: 'image/webp' | 'image/jpeg';
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Falha ao converter imagem.'));
        else resolve(b);
      },
      type,
      quality
    );
  });

const supportsMimeType = async (type: string) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    const blob = await canvasToBlob(canvas, type, 0.8);
    return blob.type === type;
  } catch {
    return false;
  }
};

const decodeToCanvas = async (file: File, targetW: number, targetH: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');

  const url = URL.createObjectURL(file);
  try {
    const anyCreateImageBitmap: any = (globalThis as any).createImageBitmap;
    if (typeof anyCreateImageBitmap === 'function') {
      let bitmap: ImageBitmap;
      try {
        bitmap = await anyCreateImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        bitmap = await anyCreateImageBitmap(file);
      }
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      try {
        bitmap.close();
      } catch {}
      return canvas;
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Falha ao carregar imagem.'));
      i.src = url;
    });
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas;
  } finally {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
};

const pickExtension = (mime: string) => {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
};

export const compressImageFileToMaxBytes = async (file: File, opts: CompressImageOptions) => {
  const maxBytes = Math.max(10 * 1024, Number(opts.maxBytes) || 0);
  if (file.size <= maxBytes) return file;

  const maxDimension = clamp(Number(opts.maxDimension || 1600), 320, 4096);
  const prefer = opts.preferMimeType || 'image/webp';
  const canWebp = await supportsMimeType('image/webp');
  const canJpeg = await supportsMimeType('image/jpeg');
  const primaryMime =
    prefer === 'image/webp'
      ? canWebp
        ? 'image/webp'
        : 'image/jpeg'
      : canJpeg
        ? 'image/jpeg'
        : 'image/webp';

  const fallbackMime = primaryMime === 'image/webp' ? 'image/jpeg' : 'image/webp';
  const candidateMimes = [primaryMime, fallbackMime].filter((t) => (t === 'image/webp' ? canWebp : canJpeg));

  const imgForSize = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      const w = i.naturalWidth || i.width;
      const h = i.naturalHeight || i.height;
      try {
        URL.revokeObjectURL(url);
      } catch {}
      resolve({ w, h });
    };
    i.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      reject(new Error('Falha ao ler dimensões da imagem.'));
    };
    i.src = url;
  });

  const originalMax = Math.max(imgForSize.w, imgForSize.h);
  let currentMaxDim = Math.min(maxDimension, originalMax || maxDimension);

  for (let dimRound = 0; dimRound < 10; dimRound++) {
    const scale = originalMax > 0 ? currentMaxDim / originalMax : 1;
    const targetW = Math.max(1, Math.round(imgForSize.w * scale));
    const targetH = Math.max(1, Math.round(imgForSize.h * scale));

    const canvas = await decodeToCanvas(file, targetW, targetH);

    for (const mime of candidateMimes) {
      for (let qRound = 0; qRound < 12; qRound++) {
        const quality = clamp(0.9 - qRound * 0.07, 0.2, 0.95);
        const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' || mime === 'image/webp' ? quality : undefined);
        if (blob.size <= maxBytes) {
          const ext = pickExtension(blob.type);
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          return new File([blob], `${baseName}.${ext}`, { type: blob.type, lastModified: Date.now() });
        }
      }
    }

    currentMaxDim = Math.max(320, Math.round(currentMaxDim * 0.85));
  }

  const lastCanvas = await decodeToCanvas(file, Math.min(320, imgForSize.w), Math.min(320, imgForSize.h));
  const fallbackBlob = await canvasToBlob(lastCanvas, candidateMimes[0] || 'image/jpeg', 0.2);
  const ext = pickExtension(fallbackBlob.type);
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return new File([fallbackBlob], `${baseName}.${ext}`, { type: fallbackBlob.type, lastModified: Date.now() });
};

