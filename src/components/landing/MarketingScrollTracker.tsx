import { useEffect } from 'react';
import { trackMarketing } from '@/lib/marketingAnalytics';

export function MarketingScrollTracker() {
  useEffect(() => {
    const reached = new Set<number>();
    const thresholds = [25, 50, 75, 100];

    const measure = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(100, Math.round(window.scrollY / scrollable * 100));
      thresholds.forEach(threshold => {
        if (progress >= threshold && !reached.has(threshold)) {
          reached.add(threshold);
          trackMarketing('landing_scroll_depth', String(threshold));
        }
      });
    };

    window.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => window.removeEventListener('scroll', measure);
  }, []);

  return null;
}
