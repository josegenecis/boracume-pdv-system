const FACEIO_SCRIPT_URL = 'https://cdn.faceio.net/fio.js';
const FACEIO_PUBLIC_ID = import.meta.env.VITE_FACEIO_PUBLIC_ID || 'fioae156';

type FaceioInstance = {
  enroll: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  authenticate: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  restartSession?: () => boolean;
};

const FACEIO_LOCALE = 'pt';

const faceioErrorMessages: Record<string, string> = {
  '1': 'Permissão de câmera recusada. Libere a câmera do navegador e tente novamente.',
  '2': 'Nenhum rosto foi detectado com segurança.',
  '3': 'Rosto não reconhecido pelo FACEIO.',
  '4': 'Muitos rostos foram detectados. Deixe somente o funcionário na câmera.',
  '5': 'A prova de vida não foi aprovada. Tente novamente com boa iluminação.',
  '6': 'O rosto não confere com a biometria cadastrada.',
  '7': 'Falha de rede ao falar com o FACEIO. Confira a conexão e tente novamente.',
  '8': 'PIN incorreto no FACEIO.',
  '9': 'O FACEIO não conseguiu processar a operação.',
  '10': 'Aplicação FACEIO não autorizada. Confira o Public ID.',
  '11': 'Os termos e a autorização da câmera não foram aceitos.',
  '12': 'Interface do FACEIO ainda não está pronta. Tente novamente.',
  '13': 'Sessão do FACEIO expirada. Tente novamente.',
  '14': 'Tempo esgotado no FACEIO. Tente novamente.',
  '15': 'Muitas tentativas no FACEIO. Aguarde alguns minutos.',
  '16': 'Origem/domínio vazio no FACEIO.',
  '17': 'Domínio atual não está liberado no console FACEIO.',
  '18': 'País bloqueado pela política da aplicação FACEIO.',
  '19': 'O FACEIO exige um PIN único para este cadastro.',
  '20': 'Já existe uma sessão FACEIO em andamento.',
  '21': 'Este rosto já está cadastrado no FACEIO. Use a opção de vincular rosto existente.',
  '22': 'Menores de idade não são permitidos nesta aplicação FACEIO.',
  '23': 'Seu plano FACEIO precisa de upgrade para este recurso.',
  '24': 'Operação cancelada pelo usuário.',
};

export class FaceioOperationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'FaceioOperationError';
    this.code = code;
  }
}

declare global {
  interface Window {
    faceIO?: new (publicId: string) => FaceioInstance;
    __popsystemFaceIO?: new (publicId: string) => FaceioInstance;
    __popsystemFaceioLoading?: Promise<void>;
    __popsystemFaceioInstance?: FaceioInstance;
    __popsystemFaceioPortuguesePatch?: boolean;
  }
}

const faceioPortugueseTranslations: Array<[RegExp, string]> = [
  [/Terms & Camera Authorization/gi, 'Termos e autorizacao da camera'],
  [/You are about to enroll via face recognition\.\.\./gi, 'Vamos cadastrar sua biometria facial...'],
  [/You are about to authenticate via face recognition\.\.\./gi, 'Vamos validar sua biometria facial...'],
  [/Simply face your camera and enter a PIN to complete enrollment\.\.\./gi, 'Olhe para a camera e informe um PIN para concluir o cadastro.'],
  [/Simply face your camera and enter your PIN to complete authentication\.\.\./gi, 'Olhe para a camera e informe seu PIN para concluir a validacao.'],
  [/No photo or image of you will be saved\./gi, 'Nenhuma foto ou imagem sua sera salva.'],
  [/Only a secure, anonymized feature vector!/gi, 'Somente um vetor facial seguro e anonimizado.'],
  [/Failed to enroll!/gi, 'Falha ao cadastrar a biometria.'],
  [/Failed to authenticate!/gi, 'Falha ao validar a biometria.'],
  [/Facial Recognition/gi, 'Reconhecimento facial'],
  [/Face Recognition/gi, 'Reconhecimento facial'],
  [/Camera Access/gi, 'Acesso a camera'],
  [/Allow Camera Access/gi, 'Permitir acesso a camera'],
  [/Waiting for camera permission/gi, 'Aguardando permissao da camera'],
  [/Processing/gi, 'Processando'],
  [/Please wait/gi, 'Aguarde'],
  [/Enter PIN/gi, 'Informe o PIN'],
  [/Choose PIN/gi, 'Escolha um PIN'],
  [/Confirm PIN/gi, 'Confirme o PIN'],
];

function isVisibleElement(element: HTMLElement | null) {
  if (!element || element.hasAttribute('hidden')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function translateFaceioText(value: string) {
  return faceioPortugueseTranslations.reduce((text, [pattern, replacement]) => {
    return text.replace(pattern, replacement);
  }, value);
}

function translateFaceioShadowRoot(root: ShadowRoot) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    const translated = translateFaceioText(node.nodeValue || '');
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });
}

function installFaceioPortuguesePatch() {
  if (window.__popsystemFaceioPortuguesePatch) return;
  window.__popsystemFaceioPortuguesePatch = true;

  const attach = () => {
    const host = document.getElementById('faceio-modal');
    const root = host?.shadowRoot;
    if (!root) return false;

    translateFaceioShadowRoot(root);
    const observer = new MutationObserver(() => translateFaceioShadowRoot(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return true;
  };

  if (attach()) return;

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (attach() || Date.now() - startedAt > 10000) {
      window.clearInterval(timer);
    }
  }, 150);
}

function getFaceioConstructor() {
  if (window.__popsystemFaceIO) return window.__popsystemFaceIO;
  if (window.faceIO) return window.faceIO;

  try {
    const fromGlobalLexical = (0, eval)('typeof faceIO !== "undefined" ? faceIO : undefined');
    if (fromGlobalLexical) {
      window.__popsystemFaceIO = fromGlobalLexical;
      return fromGlobalLexical as new (publicId: string) => FaceioInstance;
    }
  } catch {}

  return null;
}

function waitForFaceioGlobal(timeoutMs = 10000) {
  if (getFaceioConstructor()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (getFaceioConstructor()) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('FACEIO nao inicializou. Confira dominio permitido, bloqueadores do navegador e conexao com cdn.faceio.net.'));
      }
    }, 120);
  });
}

function loadFaceioScript() {
  if (getFaceioConstructor()) return Promise.resolve();
  if (window.__popsystemFaceioLoading) return window.__popsystemFaceioLoading;

  window.__popsystemFaceioLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${FACEIO_SCRIPT_URL}"]`);
    if (existing) {
      void waitForFaceioGlobal().then(resolve).catch(reject);
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
  installFaceioPortuguesePatch();
  const FaceIOConstructor = getFaceioConstructor();
  if (!FaceIOConstructor) throw new Error('FACEIO indisponivel neste navegador.');
  if (!window.__popsystemFaceioInstance) {
    window.__popsystemFaceioInstance = new FaceIOConstructor(FACEIO_PUBLIC_ID);
  }
  return window.__popsystemFaceioInstance;
}

function skipFaceioEnrollmentIntro(faceio: FaceioInstance) {
  const internalFaceio = faceio as FaceioInstance & {
    _enrollProceed?: () => void;
    _state?: number;
  };

  if (typeof internalFaceio._enrollProceed !== 'function') return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const root = document.getElementById('faceio-modal')?.shadowRoot;
    const enrollIntro = root?.getElementById('fioEnrollIntro') as HTMLElement | null;
    const extraIntro = root?.getElementById('fioExtraOpIntro') as HTMLElement | null;

    if (isVisibleElement(enrollIntro) || isVisibleElement(extraIntro)) {
      try {
        internalFaceio._enrollProceed?.();
      } catch {}
      window.clearInterval(timer);
      return;
    }

    if (attempts > 80) window.clearInterval(timer);
  }, 50);
}

export async function restartFaceioSession() {
  try {
    const faceio = await getFaceio();
    faceio.restartSession?.();
  } catch {}
}

async function withFaceioTimeout<T>(operation: Promise<T>) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('O FACEIO demorou demais para responder. Confira se o dominio popsystem.com.br esta liberado no console FACEIO e tente novamente fora do modo privado.'));
    }, 90000);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function getFaceioPublicId() {
  return FACEIO_PUBLIC_ID;
}

export async function prepareFaceio() {
  await getFaceio();
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
  return new FaceioOperationError(friendly || rawMessage || 'O FACEIO não conseguiu concluir a operação.', rawCode);
}

export function isFaceioDuplicateError(error: unknown) {
  return String((error as any)?.code || '').trim() === '21';
}

export async function enrollEmployeeFaceio(payload: Record<string, unknown>) {
  try {
    const faceio = await getFaceio();
    const operation = faceio.enroll({
      locale: FACEIO_LOCALE,
      payload,
      userConsent: true,
      showAbortBtn: true,
      enrollIntroTimeout: 5,
      permissionTimeout: 20,
      idleTimeout: 20,
      replyTimeout: 30,
    });
    skipFaceioEnrollmentIntro(faceio);
    return await withFaceioTimeout(operation);
  } catch (error) {
    throw normalizeFaceioError(error);
  }
}

export async function authenticateEmployeeFaceio(payload: Record<string, unknown>) {
  try {
    const faceio = await getFaceio();
    return await withFaceioTimeout(faceio.authenticate({
      locale: FACEIO_LOCALE,
      payload,
      showAbortBtn: true,
      permissionTimeout: 20,
      idleTimeout: 20,
      replyTimeout: 30,
    }));
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
