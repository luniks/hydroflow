import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Génère les icônes PWA (pwa-*.png, maskable, apple-touch, favicon.ico) depuis public/logo.svg :
//   npm run generate-pwa-assets
// Fond = --bg (thème sombre) de styles/tokens.css, pour les icônes qui n'ont pas de transparence.
const BACKGROUND = '#0f172a'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.2,
      resizeOptions: { background: BACKGROUND, fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.1,
      resizeOptions: { background: BACKGROUND, fit: 'contain' },
    },
  },
  images: ['public/logo.svg'],
})
