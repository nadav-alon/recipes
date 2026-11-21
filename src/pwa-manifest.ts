import type { ManifestOptions } from 'vite-plugin-pwa'

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
  theme_color: '#c24a2a',
  background_color: '#ffffff',
  display: 'standalone',
  start_url: '.',
  icons: [...sizes.map((size) => icon(size)), ...sizes.map((size) => icon(size, 'maskable'))],
}
