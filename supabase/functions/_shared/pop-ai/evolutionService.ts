export async function sendEvolutionText(restaurantId: string, instanceName: string, phone: string, text: string) {
  const baseUrl = Deno.env.get('EVOLUTION_BASE_URL') || '';
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!baseUrl || !apiKey || !instanceName || !phone || !text) {
    return { ok: false, error: 'missing_evolution_config' };
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey
    },
    body: JSON.stringify({
      number: phone,
      text,
      options: {
        delay: Math.min(2200, Math.max(600, text.length * 18)),
        presence: 'composing'
      },
      metadata: { restaurantId, source: 'pop_ai' }
    })
  });

  let primaryError: any = null;
  if (!response.ok) {
    primaryError = { error: await response.text().catch(() => response.statusText), status: response.status };
    const instanceToken = restaurantId ? `token_${String(restaurantId).replace(/-/g, '')}` : '';
    if (instanceToken) {
      const fallback = await fetch(`${baseUrl.replace(/\/+$/, '')}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: instanceToken
        },
        body: JSON.stringify({ number: phone, text })
      }).catch(() => null);

      if (fallback?.ok) {
        return {
          ok: true,
          data: await fallback.json().catch(() => null),
          transport: 'legacy-send-text',
          fallbackFrom: 'evolution-sendText'
        };
      }

      return {
        ok: false,
        error: await fallback?.text().catch(() => fallback?.statusText) || primaryError.error,
        status: fallback?.status || primaryError.status,
        primaryError
      };
    }
    return { ok: false, ...primaryError };
  }

  return { ok: true, data: await response.json().catch(() => null), transport: 'evolution-sendText' };
}

export async function sendEvolutionTyping(instanceName: string, phone: string, ms = 1200) {
  const baseUrl = Deno.env.get('EVOLUTION_BASE_URL') || '';
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!baseUrl || !apiKey || !instanceName || !phone) return { ok: false };

  const endpoints = [
    `${baseUrl.replace(/\/+$/, '')}/chat/sendPresence/${encodeURIComponent(instanceName)}`,
    `${baseUrl.replace(/\/+$/, '')}/chat/presence/${encodeURIComponent(instanceName)}`
  ];

  for (const url of endpoints) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, presence: 'composing', delay: ms })
    }).catch(() => null);
    if (response?.ok) return { ok: true };
  }

  return { ok: false };
}
