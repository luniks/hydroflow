import type { VitePWAOptions } from 'vite-plugin-pwa'

// Aligne sur --bg (theme sombre) de styles/tokens.css
const THEME_COLOR = '#0f172a'

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt', // bandeau « Nouvelle version disponible »
  includeAssets: ['logo.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
  manifest: {
    name: 'Hydroflow',
    short_name: 'Hydroflow',
    description: 'Suivi et prévision de production hydroélectrique, St-Jean-de-Rive',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/hubeau\.eaufrance\.fr\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'hubeau',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 6 * 3600 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'open-meteo',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 30, maxAgeSeconds: 6 * 3600 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: /^https:\/\/api\.luniks\.fr\/vigicrues.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'vigicrues',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 20, maxAgeSeconds: 6 * 3600 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
}
