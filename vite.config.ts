/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './src/pwa-manifest.ts'

export default defineConfig({
  base: '/recipes/',
  plugins: [preact(), Icons({ compiler: 'jsx', jsx: 'preact', scale: 1 }), VitePWA({ registerType: 'autoUpdate', manifest })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
