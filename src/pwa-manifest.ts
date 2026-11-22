import type { ManifestOptions } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { SEED } from './seed.ts'

/**
 * The light scheme's background role, read from the generated `theme.css` (the config is loaded by
 * plain Node, which cannot load household-ui's TypeScript); `theme.test.ts` pins that file to the seed.
 */
const lightBackground = readFileSync('src/theme.css', 'utf8').match(
  /--md-sys-color-background: (#[0-9a-f]{6});/,
)![1]

const sizes = [192, 512]

const icon = (size: number, purpose?: 'maskable') => ({
  src: `pwa-${purpose ? `${purpose}-` : ''}${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
  ...(purpose && { purpose }),
})

export const manifest: Partial<ManifestOptions> = {
  name: 'Recipes',
  short_name: 'Recipes',
  description: 'Decide what to cook from what the catalogue says is at home',
  theme_color: SEED,
  background_color: lightBackground,
  display: 'standalone',
  start_url: '.',
  icons: [...sizes.map((size) => icon(size)), ...sizes.map((size) => icon(size, 'maskable'))],
}
