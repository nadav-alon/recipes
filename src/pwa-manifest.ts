import type { ManifestOptions } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { iconSpecs, type IconSpec } from './pwa-icons.ts'
import { SEED } from './seed.ts'

/**
 * The light scheme's background role, read from the generated `theme.css` (the config is loaded by
 * plain Node, which cannot load household-ui's TypeScript); `theme.test.ts` pins that file to the seed.
 */
const lightBackground = readFileSync(join(import.meta.dirname, 'theme.css'), 'utf8').match(
  /--md-sys-color-background: (#[0-9a-f]{6});/,
)?.[1]
if (!lightBackground) throw new Error('theme.css has no --md-sys-color-background')

/**
 * The URL of an icon file in `dir`, versioned by its content (`?v=` and the first 8 hex of its
 * sha256), so an installed app sees a new URL, and refreshes the icon, exactly when the bytes change.
 */
export const versionedIconSrc = (file: string, dir = join(import.meta.dirname, '..', 'public')) =>
  `${file}?v=${createHash('sha256').update(readFileSync(join(dir, file))).digest('hex').slice(0, 8)}`

const icon = ({ file, sizes, purpose }: IconSpec) => ({
  src: versionedIconSrc(file),
  sizes,
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
  icons: iconSpecs.map(icon),
}
