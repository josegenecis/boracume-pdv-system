export type PrepareBannerVideoOptions = {
  maxBytes: number;
  maxDurationSeconds: number;
  maxSourceBytes?: number;
};

type VideoMetadata = {
  duration: number;
  width: number;
  height: number;
};

const waitForEvent = <T extends Event>(target: EventTarget, success: string, failure: string) =>
  new Promise<T>((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup();
      resolve(event as T);
    };
    const onFailure = () => {
      cleanup();
      reject(new Error('Falha ao processar vídeo.'));
    };
    const cleanup = () => {
      target.removeEventListener(success, onSuccess);
      target.removeEventListener(failure, onFailure);
    };
    target.addEventListener(success, onSuccess, { once: true });
    target.addEventListener(failure, onFailure, { once: true });
  });

const getSupportedRecorderType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const loadVideoMetadata = async (file: File): Promise<VideoMetadata> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    video.src = url;
    await waitForEvent(video, 'loadedmetadata', 'error');
    return {
      duration: Number(video.duration || 0),
      width: Number(video.videoWidth || 0),
      height: Number(video.videoHeight || 0)
    };
  } finally {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
};

const compressVideoPass = async (file: File, targetBytes: number, targetMaxDimension: number, mimeType: string) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  try {
    await waitForEvent(video, 'loadedmetadata', 'error');

    const sourceWidth = Math.max(1, video.videoWidth || 1);
    const sourceHeight = Math.max(1, video.videoHeight || 1);
    const sourceDuration = Math.max(0.1, Number(video.duration || 0.1));
    const scale = Math.min(1, targetMaxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível para processar o vídeo.');

    const capture = (canvas as any).captureStream?.bind(canvas);
    if (!capture) throw new Error('Seu navegador não suporta compactação automática de vídeo.');

    const stream = capture(24) as MediaStream;
    const videoBitrate = Math.max(220_000, Math.min(1_600_000, Math.floor((targetBytes * 8 * 0.92) / sourceDuration)));
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('Falha ao compactar o vídeo.'));
    });

    let raf = 0;
    const drawFrame = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, width, height);
      raf = window.requestAnimationFrame(drawFrame);
    };

    recorder.start(250);
    try {
      await video.play();
    } catch {
      throw new Error('Não foi possível reproduzir o vídeo para compactação.');
    }
    drawFrame();
    await waitForEvent(video, 'ended', 'error');
    window.cancelAnimationFrame(raf);
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([blob], `${baseName}.webm`, { type: mimeType, lastModified: Date.now() });
  } finally {
    try {
      video.pause();
    } catch {}
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
};

export const prepareBannerVideoFile = async (file: File, options: PrepareBannerVideoOptions) => {
  if (!file.type.startsWith('video/')) {
    throw new Error('Selecione um arquivo de vídeo válido.');
  }

  const maxBytes = Math.max(256 * 1024, Number(options.maxBytes) || 0);
  const maxDurationSeconds = Math.max(1, Number(options.maxDurationSeconds) || 0);
  const maxSourceBytes = Math.max(maxBytes, Number(options.maxSourceBytes || 30 * 1024 * 1024));
  if (file.size > maxSourceBytes) {
    throw new Error('O vídeo é muito grande para processamento. Use um arquivo menor.');
  }

  const metadata = await loadVideoMetadata(file);
  if (!metadata.duration || Number.isNaN(metadata.duration)) {
    throw new Error('Não foi possível identificar a duração do vídeo.');
  }

  if (metadata.duration > maxDurationSeconds) {
    throw new Error(`O vídeo pode ter no máximo ${maxDurationSeconds} segundos.`);
  }

  if (file.size <= maxBytes) {
    return {
      file,
      durationSeconds: metadata.duration,
      compressed: false
    };
  }

  const mimeType = getSupportedRecorderType();
  if (!mimeType) {
    throw new Error('Seu navegador não suporta compactação automática desse vídeo. Envie um arquivo de até 2MB.');
  }

  const targetDimensions = [720, 540, 420, 360];
  for (const dimension of targetDimensions) {
    const compressed = await compressVideoPass(file, maxBytes, dimension, mimeType);
    if (compressed.size <= maxBytes) {
      return {
        file: compressed,
        durationSeconds: metadata.duration,
        compressed: true
      };
    }
  }

  throw new Error('Não foi possível compactar o vídeo para até 2MB. Tente um arquivo menor ou com menos detalhes.');
};
