const pad2 = (n: number) => String(n).padStart(2, '0');

const emv = (id: string, value: string) => `${id}${pad2(value.length)}${value}`;

const crc16Ccitt = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const normalizeText = (input: string, max: number) => {
  const value = (input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return value.replace(/[^A-Za-z0-9 .,&-]/g, '').trim().slice(0, max) || 'PopSystem';
};

export function buildPixPayload(params: {
  pixKey: string;
  amount: number;
  merchantName?: string;
  merchantCity?: string;
  txid?: string;
  description?: string;
}) {
  const key = (params.pixKey || '').trim();
  if (!key) throw new Error('Chave Pix não configurada');

  const merchantName = normalizeText(params.merchantName || 'PopSystem', 25);
  const merchantCity = normalizeText(params.merchantCity || 'BRASIL', 15);
  const txid = normalizeText(params.txid || '***', 25);
  const amount = Number(params.amount || 0);

  const gui = emv('00', 'BR.GOV.BCB.PIX');
  const pixKey = emv('01', key);
  const desc = params.description ? emv('02', normalizeText(params.description, 50)) : '';
  const merchantAccount = emv('26', `${gui}${pixKey}${desc}`);

  const additional = emv('62', emv('05', txid));

  const payloadWithoutCrc = [
    emv('00', '01'),
    emv('01', '12'),
    merchantAccount,
    emv('52', '0000'),
    emv('53', '986'),
    emv('54', amount.toFixed(2)),
    emv('58', 'BR'),
    emv('59', merchantName),
    emv('60', merchantCity),
    additional,
    '6304'
  ].join('');

  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}

