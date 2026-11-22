import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { manifest } from '../src/pwa-manifest.ts'
import { SEED } from '../src/seed.ts'
import { flatPng } from './flat-png.ts'

describe('PWA icons', () => {
  it('are green, flat squares of the seed at every size the manifest lists, maskable included', () => {
    const [r, g, b] = Buffer.from(SEED.slice(1), 'hex')
    expect(g).toBeGreaterThan(r!)
    expect(g).toBeGreaterThan(b!)
    expect(manifest.icons!.length).toBeGreaterThan(0)
    for (const icon of manifest.icons!) {
      const size = Number(icon.sizes!.split('x')[0])
      expect(readFileSync(`public/${icon.src}`).equals(flatPng(size, SEED)), icon.src).toBe(true)
    }
  })
})
