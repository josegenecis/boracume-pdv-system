const FACEIO_SCRIPT_URL = 'https://cdn.faceio.net/fio.js';
const FACEIO_PUBLIC_ID = import.meta.env.VITE_FACEIO_PUBLIC_ID || 'fioae156';

type FaceioInstance = {
  enroll: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  authenticate: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const faceioErrorMessages: Record<string, string> = {
  '1': 'A câmera não pôde ser acessada. Confira a permissão do navegador.',
  '2': 'Permissão de câmera negada.',
  '3': 'Nenhum rosto foi detectado com segurança.',
  '4': 'Muitos rostos foram detectados. Deixe somente o funcionário na câmera.',
  '5': 'Sessão expirada. Tente novamente.',
  '6': 'Tentativa cancelada.',
  '7': 'O domínio atual não está liberado no FACEIO.',
  '8': 'O FACEIO bloqueou a operação por política de segurança.',
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
  if (!document.getElementById('faceio-modal')) {
    const modal = document.createElement('div');
    modal.id = 'faceio-modal';
    document.body.appendChild(modal);
  }
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

function normalizeFaceioError(error: unknown) {
  const rawCode = String(
    (error as any)?.code ||
    (error as any)?.fioErrCode ||
    (error as any)?.errorCode ||
    '',
  );
  const rawMessage = String((error as any)?.message || error || '').trim();
  const friendly = faceioErrorMessages[rawCode];
  return new Error(friendly || rawMessage || 'O FACEIO não conseguiu concluir a operação.');
}

export async function enrollEmployeeFaceio(payload: Record<string, unknown>) {
  try {
    const faceio = await getFaceio();
    return await faceio.enroll({
      locale: 'pt-br',
      payload,
    });
  } catch (error) {
    throw normalizeFaceioError(error);
  }
}

export async function authenticateEmployeeFaceio(payload: Record<string, unknown>) {
  try {
    const faceio = await getFaceio();
    return await faceio.authenticate({
      locale: 'pt-br',
      payload,
    });
  } catch (error) {
    throw normalizeFaceioError(error);
  }
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
