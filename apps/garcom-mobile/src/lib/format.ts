export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function minutesSince(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

export function formatMinutes(value: number) {
  if (value < 60) {
    return `${value} min`;
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
