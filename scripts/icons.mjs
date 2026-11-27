// Regenerates the PWA icons in public/ from the cooking-pot SVG in scripts/icons/, which renderIcon fills with the seed in src/seed.ts and its on-primary colour.
// The icon list is the manifest's: one file per entry, drawn by renderIcon.
import { writeFileSync } from 'node:fs'
import { manifest } from '../src/pwa-manifest.ts'
import { renderIcon } from './app-icons.ts'

for (const icon of manifest.icons ?? []) writeFileSync(`public/${icon.src.split('?')[0]}`, renderIcon(icon))
