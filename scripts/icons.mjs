// Regenerates the PWA icons in public/ as flat squares of the seed in src/seed.ts, the one place the accent is written.
import { writeFileSync } from 'node:fs'
import { SEED } from '../src/seed.ts'
import { flatPng } from './flat-png.ts'

for (const size of [192, 512]) {
  for (const name of [`pwa-${size}x${size}.png`, `pwa-maskable-${size}x${size}.png`]) {
    writeFileSync(`public/${name}`, flatPng(size, SEED))
  }
}
