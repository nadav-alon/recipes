// Regenerates the PWA icons in public/ as flat squares of the seed in src/seed.ts, the one place the accent is written.
// The icon list is the manifest's: one file per entry, sized from its `sizes`.
import { writeFileSync } from 'node:fs'
import { SEED } from '../src/seed.ts'
import { manifest } from '../src/pwa-manifest.ts'
import { flatPng } from './flat-png.ts'

for (const icon of manifest.icons ?? []) {
  const size = Number.parseInt(icon.sizes, 10)
  writeFileSync(`public/${icon.src}`, flatPng(size, SEED))
}
