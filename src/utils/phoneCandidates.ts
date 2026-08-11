const digitsOnly = (value?: string | null) => String(value || '').replace(/\D/g, '');

export function buildBrazilPhoneCandidates(value?: string | null) {
  const raw = digitsOnly(value);
  const local = raw.startsWith('55') ? raw.slice(2) : raw;
  const localVariants = new Set<string>([local]);

  // O WhatsApp pode devolver números brasileiros antigos sem o nono dígito.
  if (local.length === 11 && local[2] === '9') localVariants.add(`${local.slice(0, 2)}${local.slice(3)}`);
  if (local.length === 10) localVariants.add(`${local.slice(0, 2)}9${local.slice(2)}`);

  const candidates = new Set<string>();
  for (const phone of localVariants) {
    if (!phone) continue;
    candidates.add(phone);
    candidates.add(`55${phone}`);
  }
  return Array.from(candidates);
}

export function phonesAreEquivalent(first?: string | null, second?: string | null) {
  const secondCandidates = new Set(buildBrazilPhoneCandidates(second));
  return buildBrazilPhoneCandidates(first).some((candidate) => secondCandidates.has(candidate));
}
