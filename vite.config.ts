import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'desktop' ? './' : '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    // Builds publicados eram enviados sem minificação. Isso fazia a tela de
    // login baixar e interpretar um App chunk desnecessariamente grande,
    // sobretudo perceptível no desktop e em conexões móveis.
    minify: mode === 'development' ? false : 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {},
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js']
  }
}));
