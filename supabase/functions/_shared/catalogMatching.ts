export type CatalogCandidate = {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  track_stock?: boolean | null;
};

const IGNORED_TOKENS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "tipo",
  "un", "und", "unidade", "kg", "g", "gr", "l", "lt", "ml", "cx",
  "caixa", "pct", "pacote", "fd", "fardo", "bd", "balde", "dz", "duzia",
]);

export function normalizeCatalogName(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(ml|l|lt|g|gr|kg|un|und)\b/g, " $1$2 ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: unknown) {
  return normalizeCatalogName(value)
    .split(" ")
    .filter((token) => token.length > 1 && !IGNORED_TOKENS.has(token));
}

function specificationTokens(value: unknown) {
  return normalizeCatalogName(value)
    .split(" ")
    .filter((token) => /\d/.test(token));
}

export function catalogSimilarity(left: unknown, right: unknown) {
  const a = normalizeCatalogName(left);
  const b = normalizeCatalogName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aSpecs = specificationTokens(a);
  const bSpecs = specificationTokens(b);
  if (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a))) {
    if (aSpecs.length !== bSpecs.length && (aSpecs.length === 0 || bSpecs.length === 0)) return 0.68;
    if (aSpecs.length > 0 && bSpecs.length > 0 && !aSpecs.some((specification) => bSpecs.includes(specification))) return 0.55;
    return 0.9;
  }

  const aTokens = new Set(tokens(a));
  const bTokens = new Set(tokens(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) if (bTokens.has(token)) intersection += 1;
  if (intersection === 0) return 0;
  const union = new Set([...aTokens, ...bTokens]).size;
  const coverage = intersection / Math.min(aTokens.size, bTokens.size);
  const rawScore = intersection / union * 0.55 + coverage * 0.45;
  const hasConflictingSpecification = aSpecs.length > 0 && bSpecs.length > 0
    && !aSpecs.some((specification) => bSpecs.includes(specification));
  return Number((hasConflictingSpecification ? Math.min(rawScore, 0.55) : rawScore).toFixed(4));
}

export function findBestCatalogMatch<T extends CatalogCandidate>(
  name: unknown,
  catalog: T[],
  preferredName?: unknown,
  threshold = 0.72,
) {
  const matches: Array<{ candidate: T; score: number }> = [];
  const lookupNames = [preferredName, name].filter(Boolean);
  for (const candidate of catalog) {
    const score = Math.max(...lookupNames.map((lookup) => catalogSimilarity(lookup, candidate.name)));
    matches.push({ candidate, score });
  }
  matches.sort((left, right) => right.score - left.score);
  const best = matches[0];
  const runnerUp = matches[1];
  if (!best || best.score < threshold) return null;
  if (best.score < 1 && runnerUp && runnerUp.score >= threshold && best.score - runnerUp.score < 0.04) return null;
  return best;
}
