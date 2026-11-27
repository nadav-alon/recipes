/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { iconSpecs } from './src/pwa-icons.ts'
import { manifest } from './src/pwa-manifest.ts'
import { SEED } from './src/seed.ts'

/** Puts the seed in `<head>` as the browser chrome colour, matching the manifest's `theme_color`. */
const themeColour = (): Plugin => ({
  name: 'theme-colour',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: SEED }, injectTo: 'head' }],
})

/** Gives the favicon the manifest's content-versioned URL for the same icon, so it too tracks the icon's bytes. */
const faviconVersion = (): Plugin => ({
  name: 'favicon-version',
  transformIndexHtml: (html) =>
    html.replace(/(<link rel="icon"[^>]*href="[^"]*\/)(pwa-[^"?]+\.png)"/, (_, head: string, file: string) => {
      const icon = manifest.icons!.find((i) => i.src.startsWith(`${file}?`))
      if (!icon) throw new Error(`favicon ${file} is not a manifest icon`)
      return `${head}${icon.src}"`
    }),
})

export default defineConfig({
  base: '/recipes/',
  plugins: [preact(), Icons({ compiler: 'jsx', jsx: 'preact', scale: 1 }), themeColour(), faviconVersion(), VitePWA({
      registerType: 'autoUpdate',
      manifest,
      // The manifest's versioned icon URLs are not file globs, so precache the bare files and let the `?v=` URLs hit them.
      includeAssets: iconSpecs.map((i) => i.file),
      workbox: { ignoreURLParametersMatching: [/^v$/] },
    })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
