export const formatElapsedMinutes = (value: number) => {
  const totalMinutes = Math.max(0, Math.floor(Number(value) || 0));
  if (totalMinutes < 1) return 'agora';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};

export const minutesSinceDate = (value: string | Date) => {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
};

export const formatElapsedSince = (value: string | Date) => formatElapsedMinutes(minutesSinceDate(value));
