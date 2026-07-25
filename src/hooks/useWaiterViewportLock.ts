import { useEffect } from 'react';

const WAITER_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export function useWaiterViewportLock() {
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previousViewport = viewport?.content || '';

    viewport?.setAttribute('content', WAITER_VIEWPORT);
    document.documentElement.classList.add('waiter-app-active');
    document.body.classList.add('waiter-app-active');

    return () => {
      if (previousViewport) viewport?.setAttribute('content', previousViewport);
      document.documentElement.classList.remove('waiter-app-active');
      document.body.classList.remove('waiter-app-active');
    };
  }, []);
}
