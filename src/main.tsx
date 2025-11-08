import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// import SimpleApp from './App.simple.tsx'
// import AuthOnlyApp from './App.auth-only.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
