/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Même proxy que Library : une seule origine, le cookie SameSite=Lax repart.
// `VITE_API_TARGET` (shell ou `.env.local`) vise une autre API ; `loadEnv` et
// non `process.env`, qui ignore les fichiers `.env` (voir Library).
export default defineConfig(({ mode }) => {
  const API = loadEnv(mode, process.cwd(), '').VITE_API_TARGET || 'http://localhost:3000'

  return {
    // Le Journal vit sous /journal/ en ligne, et donc aussi en dev.
    base: '/journal/',
    plugins: [
      react(),
      VitePWA({
        // Jamais de rechargement forcé en pleine partie : la nouvelle version
        // attend que le joueur la demande (le bandeau de `pwa/MiseAJour.tsx`).
        registerType: 'prompt',
        // L'enregistrement passe par `useRegisterSW`, pas par un script injecté.
        injectRegister: false,
        manifest: {
          name: 'Journal',
          short_name: 'Journal',
          lang: 'fr',
          start_url: '/journal/',
          scope: '/journal/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#151009',
          background_color: '#151009',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // L'enveloppe et les images des mondes : rien de /api/ ni de /covers/ n'est mis en
          // cache, aucune vidéo non plus. Le repli de navigation sert index.html, relatif à la portée /journal/.
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webp}'],
        },
      }),
    ],
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
      // Le fuseau du propriétaire, partout : sur la CI (UTC), un jour calculé à Greenwich plutôt
      // qu'au téléphone passerait inaperçu (`ui/format.ts`, `jourLocal`).
      env: { TZ: 'Europe/Paris' },
      // Vitest vide les feuilles de style qu'il importe ; `?raw` doit passer intact, pour que
      // `ui/theme.test.ts` lise ce que les feuilles portent vraiment.
      css: { include: [/[?&]raw\b/] },
    },
  }
})
