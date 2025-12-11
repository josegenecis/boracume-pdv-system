import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// import SimpleApp from './App.simple.tsx'
// import AuthOnlyApp from './App.auth-only.tsx'
import './index.css'

// Service Worker para Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
