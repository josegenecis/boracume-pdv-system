export const formatBRL = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (numericValue === null || numericValue === undefined || Number.isNaN(Number(numericValue))) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(numericValue));
};

export const formatBRLFromCents = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (numericValue === null || numericValue === undefined || Number.isNaN(Number(numericValue))) {
    return 'R$ 0,00';
  }

  return formatBRL(Number(numericValue) / 100);
};
