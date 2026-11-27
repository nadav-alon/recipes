// Regenerates the PWA icons in public/ from the cooking-pot SVG in scripts/icons/, which renderIcon fills with the seed in src/seed.ts and its on-primary colour.
// The icon list is src/pwa-icons.ts's, which reads no files, so a missing icon can be created: one file per entry, drawn by renderIcon.
import { writeFileSync } from 'node:fs'
import { iconSpecs } from '../src/pwa-icons.ts'
import { renderIcon } from './app-icons.ts'

for (const icon of iconSpecs) writeFileSync(`public/${icon.file}`, renderIcon(icon))
