export async function sendEvolutionText(restaurantId: string, instanceName: string, phone: string, text: string) {
  const baseUrl = Deno.env.get('EVOLUTION_BASE_URL') || '';
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!baseUrl || !apiKey || !instanceName || !phone || !text) {
    return { ok: false, error: 'missing_evolution_config' };
  }

  const base = baseUrl.replace(/\/+$/, '');
  const number = String(phone || '').replace(/\D/g, '').startsWith('55')
    ? String(phone || '').replace(/\D/g, '')
    : `55${String(phone || '').replace(/\D/g, '')}`;
  const message = String(text || '').trim();
  const encodedInstance = encodeURIComponent(instanceName);
  const delay = Math.min(2200, Math.max(600, message.length * 18));
  const instanceToken = restaurantId ? `token_${String(restaurantId).replace(/-/g, '')}` : '';
  const attempts: any[] = [];
  const request = async (transport: string, url: string, key: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key
      },
      body: JSON.stringify(body)
    }).catch((error) => ({ ok: false, status: 0, text: async () => String(error?.message || error || 'network_error'), json: async () => ({}) }) as any);

    const data = await response.json().catch(async () => ({ error: await response.text().catch(() => response.statusText) }));
    const result = { ok: Boolean(response.ok), status: response.status || null, data, transport };
    attempts.push(result);
    return result;
  };

  const globalAttempts = [
    {
      transport: 'evolution-message-sendText-text',
      url: `${base}/message/sendText/${encodedInstance}`,
      key: apiKey,
      body: { number, text: message, options: { delay, presence: 'composing' }, metadata: { restaurantId, source: 'pop_ai' } }
    },
    {
      transport: 'evolution-message-sendText-message',
      url: `${base}/message/sendText/${encodedInstance}`,
      key: apiKey,
      body: { number, message, options: { delay, presence: 'composing' }, metadata: { restaurantId, source: 'pop_ai' } }
    },
    {
      transport: 'evolution-send-text-instance',
      url: `${base}/send/text/${encodedInstance}`,
      key: apiKey,
      body: { number, text: message, delay, linkPreview: true }
    },
    {
      transport: 'evolution-chat-sendMessage',
      url: `${base}/chat/sendMessage/${encodedInstance}`,
      key: apiKey,
      body: { number, text: message, delay, linkPreview: true }
    },
    {
      transport: 'evolution-send-text-global',
      url: `${base}/send/text`,
      key: apiKey,
      body: { instanceName, instance: instanceName, number, text: message, delay, linkPreview: true }
    }
  ];

  for (const attempt of globalAttempts) {
    const result = await request(attempt.transport, attempt.url, attempt.key, attempt.body);
    if (result.ok) return result;
  }

  if (instanceToken) {
    const tokenAttempts = [
      {
        transport: 'legacy-send-text-token',
        url: `${base}/send/text`,
        key: instanceToken,
        body: { number, text: message }
      },
      {
        transport: 'legacy-message-sendText-token',
        url: `${base}/message/sendText/${encodedInstance}`,
        key: instanceToken,
        body: { number, text: message, delay, linkPreview: true }
      }
    ];

    for (const attempt of tokenAttempts) {
      const result = await request(attempt.transport, attempt.url, attempt.key, attempt.body);
      if (result.ok) return result;
    }
  }

  return {
    ok: false,
    error: 'all_send_attempts_failed',
    status: attempts[0]?.status || null,
    attempts: attempts.map((attempt) => ({
      transport: attempt.transport,
      ok: Boolean(attempt.ok),
      status: attempt.status || null,
      data: attempt.data || null
    }))
  };
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
