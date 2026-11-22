/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './src/pwa-manifest.ts'
import { SEED } from './src/seed.ts'

/** Puts the seed in `<head>` as the browser chrome colour, matching the manifest's `theme_color`. */
const themeColour = (): Plugin => ({
  name: 'theme-colour',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: SEED }, injectTo: 'head' }],
})

export default defineConfig({
  base: '/recipes/',
  plugins: [preact(), Icons({ compiler: 'jsx', jsx: 'preact', scale: 1 }), themeColour(), VitePWA({ registerType: 'autoUpdate', manifest })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
