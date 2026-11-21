import type { ManifestOptions } from 'vite-plugin-pwa'

export const themeColor = '#c24a2a'

const sizes = [192, 512]

export const manifest: Partial<ManifestOptions> = {
  name: 'Recipes',
  short_name: 'Recipes',
  description: 'Decide what to cook from what the household has at home',
  theme_color: themeColor,
  background_color: '#ffffff',
  display: 'standalone',
  start_url: '.',
  icons: [
    ...sizes.map((size) => ({
      src: `pwa-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
    ...sizes.map((size) => ({
      src: `pwa-maskable-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'maskable' as const,
    })),
  ],
}
