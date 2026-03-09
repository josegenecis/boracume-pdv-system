type PerfMeta = Record<string, any>;

type PerfEntry = {
  name: string;
  ms: number;
  at: number;
  meta?: PerfMeta;
};

const STORE_KEY = 'boracume_perf_entries';
const ENABLE_KEY = 'boracume_perf_debug';
const MAX_ENTRIES = 200;

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function isPerfEnabled() {
  try {
    return localStorage.getItem(ENABLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPerfEnabled(enabled: boolean) {
  try {
    localStorage.setItem(ENABLE_KEY, enabled ? '1' : '0');
  } catch {}
}

export function recordPerf(name: string, ms: number, meta?: PerfMeta) {
  const entry: PerfEntry = { name, ms, at: Date.now(), meta };
  if (isPerfEnabled()) {
    try {
      const line = meta ? `${name} ${ms.toFixed(1)}ms` : `${name} ${ms.toFixed(1)}ms`;
      console.debug('[perf]', line, meta || '');
    } catch {}
  }

  try {
    const current = safeParse<PerfEntry[]>(localStorage.getItem(STORE_KEY)) || [];
    current.push(entry);
    const sliced = current.length > MAX_ENTRIES ? current.slice(current.length - MAX_ENTRIES) : current;
    localStorage.setItem(STORE_KEY, JSON.stringify(sliced));
  } catch {}
}

export function perfStart(name: string, meta?: PerfMeta) {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    end(extraMeta?: PerfMeta) {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      recordPerf(name, end - start, extraMeta ? { ...(meta || {}), ...extraMeta } : meta);
    }
  };
}

