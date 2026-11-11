/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwa.config.ts'

export default defineConfig({
  // Le service worker n'a aucun sens sous Vitest (jsdom) : on le desactive.
  plugins: [vue(), tailwindcss(), VitePWA({ ...pwaOptions, disable: !!process.env.VITEST })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
