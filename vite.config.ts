/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Même proxy que Library : une seule origine, le cookie SameSite=Lax repart.
// `VITE_API_TARGET` (shell ou `.env.local`) vise une autre API ; `loadEnv` et
// non `process.env`, qui ignore les fichiers `.env` (voir Library).
export default defineConfig(({ mode }) => {
  const API = loadEnv(mode, process.cwd(), '').VITE_API_TARGET || 'http://localhost:3000'

  return {
    // Le Journal vit sous /journal/ en ligne, et donc aussi en dev.
    base: '/journal/',
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      // Joignable depuis le téléphone sur le réseau local.
      host: true,
      proxy: {
        '/api': { target: API, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
        '/covers': { target: API, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
