// Regenerates the PWA icons in public/ from the cooking-pot SVGs in scripts/icons/, whose colours are the seed in src/seed.ts.
// The icon list is the manifest's: one file per entry, drawn by renderIcon.
import { writeFileSync } from 'node:fs'
import { manifest } from '../src/pwa-manifest.ts'
import { renderIcon } from './app-icons.ts'

for (const icon of manifest.icons ?? []) writeFileSync(`public/${icon.src}`, renderIcon(icon))
