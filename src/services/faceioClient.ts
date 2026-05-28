const FACEIO_SCRIPT_URL = 'https://cdn.faceio.net/fio.js';
const FACEIO_PUBLIC_ID = import.meta.env.VITE_FACEIO_PUBLIC_ID || 'fioae156';

type FaceioInstance = {
  enroll: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  authenticate: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

declare global {
  interface Window {
    faceIO?: new (publicId: string) => FaceioInstance;
    __popsystemFaceioLoading?: Promise<void>;
    __popsystemFaceioInstance?: FaceioInstance;
  }
}

function loadFaceioScript() {
  if (window.faceIO) return Promise.resolve();
  if (window.__popsystemFaceioLoading) return window.__popsystemFaceioLoading;

  window.__popsystemFaceioLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${FACEIO_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Nao foi possivel carregar o FACEIO.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = FACEIO_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Nao foi possivel carregar o FACEIO.'));
    document.head.appendChild(script);
  });

  return window.__popsystemFaceioLoading;
}

async function getFaceio() {
  await loadFaceioScript();
  if (!window.faceIO) throw new Error('FACEIO indisponivel neste navegador.');
  if (!window.__popsystemFaceioInstance) {
    window.__popsystemFaceioInstance = new window.faceIO(FACEIO_PUBLIC_ID);
  }
  return window.__popsystemFaceioInstance;
}

export function getFaceioPublicId() {
  return FACEIO_PUBLIC_ID;
}

export async function enrollEmployeeFaceio(payload: Record<string, unknown>) {
  const faceio = await getFaceio();
  return faceio.enroll({
    locale: 'pt-br',
    payload,
  });
}

export async function authenticateEmployeeFaceio(payload: Record<string, unknown>) {
  const faceio = await getFaceio();
  return faceio.authenticate({
    locale: 'pt-br',
    payload,
  });
}

export function extractFaceioFacialId(response: Record<string, unknown> | null | undefined) {
  return String(
    response?.facialId ||
    response?.face_id ||
    response?.faceId ||
    response?.userId ||
    '',
  ).trim();
}
