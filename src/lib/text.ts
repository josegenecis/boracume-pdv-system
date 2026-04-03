export const normalizeComplementOptionName = (value: string | null | undefined) => {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const lower = trimmed.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
};
