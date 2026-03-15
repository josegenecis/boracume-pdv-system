export type GeminiFunctionDeclaration = {
  name: string;
  description?: string;
  parameters?: any;
};

export type GeminiGenerateOptions = {
  apiKey: string;
  model: string;
  system?: string;
  user: string;
  temperature?: number;
  responseMimeType?: string;
  tools?: GeminiFunctionDeclaration[];
  functionCallingMode?: 'AUTO' | 'ANY' | 'NONE';
  contents?: any[];
};

function pickTextFromResponse(data: any): string {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const textParts = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean);
  return textParts.join('\n').trim();
}

function pickFunctionCallsFromResponse(data: any): Array<{ name: string; args: any }> {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return [];
  const calls: Array<{ name: string; args: any }> = [];
  for (const p of parts) {
    const fc = p?.functionCall;
    if (fc?.name) calls.push({ name: String(fc.name), args: fc.args ?? {} });
  }
  return calls;
}

export async function geminiGenerateContent(opts: GeminiGenerateOptions) {
  const model = String(opts.model || '').trim();
  if (!model) throw new Error('Modelo Gemini não informado.');
  const apiKey = String(opts.apiKey || '').trim();
  if (!apiKey) throw new Error('Chave Gemini não configurada.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: any = {
    generationConfig: {
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2
    }
  };

  if (opts.responseMimeType) {
    body.generationConfig.responseMimeType = opts.responseMimeType;
  }

  if (opts.system) {
    body.systemInstruction = { parts: [{ text: String(opts.system) }] };
  }

  if (Array.isArray(opts.contents)) {
    body.contents = opts.contents;
  } else {
    body.contents = [{ role: 'user', parts: [{ text: String(opts.user || '') }] }];
  }

  if (Array.isArray(opts.tools) && opts.tools.length > 0) {
    body.tools = [{ functionDeclarations: opts.tools }];
    body.toolConfig = { functionCallingConfig: { mode: opts.functionCallingMode || 'AUTO' } };
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Erro Gemini: ${resp.status} - ${text}`);
  }

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do Gemini.');
  }

  return {
    raw: data,
    text: pickTextFromResponse(data),
    functionCalls: pickFunctionCallsFromResponse(data)
  };
}

export function safeParseJson(text: string) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {}
  }
  return null;
}

