import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// import SimpleApp from './App.simple.tsx'
// import AuthOnlyApp from './App.auth-only.tsx'
import './index.css'

// Global Error Handler for debugging white screens
window.addEventListener('error', (event) => {
  console.error('Global Error Caught:', event.error);
  // Optional: You could render a fallback UI directly into document.body here if React fails completely
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Service Worker: registrar sempre em produção para habilitar PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Link de força para limpar SW/caches e recarregar automaticamente
(function() {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('clear_sw') === '1') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {})
      }
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
      }
      url.searchParams.delete('clear_sw')
      url.searchParams.set('v', String(Date.now()))
      window.location.replace(url.toString())
    }
  } catch {}
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
