/// <reference types="vite/client" />

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_BROWSER_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
