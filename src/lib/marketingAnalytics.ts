import { track } from '@vercel/analytics';

export const trackMarketing = (event: string, detail?: string) => {
  try {
    track(event, detail ? { detail } : undefined);
  } catch {
    // Analytics must never interrupt a sale or navigation.
  }
};
