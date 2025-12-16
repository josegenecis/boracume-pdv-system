import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// import SimpleApp from './App.simple.tsx'
// import AuthOnlyApp from './App.auth-only.tsx'
import './index.css'

// Service Worker para Push Notifications (desativado por padrão)
if ('serviceWorker' in navigator) {
  const enableSW = import.meta.env.VITE_ENABLE_SW === 'true'
  if (enableSW) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    // Se desativado, garantir que SW antigo seja removido e caches limpos
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
    }
  }
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
