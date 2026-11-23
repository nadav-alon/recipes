import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { manifest } from '../src/pwa-manifest.ts'
import { colourRoleHex, seedColour } from 'household-ui/ui/colourRoles.ts'
import { SEED } from '../src/seed.ts'
import { renderIcon } from './app-icons.ts'

const seedPixel = `${SEED.slice(1)}ff`
const glyphPixel = `${colourRoleHex(seedColour(SEED), 'onPrimary', 'light').slice(1)}ff`

/** The rows of an 8-bit RGBA PNG, each `width * 4` bytes. */
function decode(png: Buffer): { width: number; rows: Buffer[] } {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  expect(png[24], 'bit depth').toBe(8)
  expect(png[25], 'colour type RGBA').toBe(6)
  const idat: Buffer[] = []
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at)
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length))
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    const prev = rows[y - 1] ?? Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? row[i - 4]! : 0
      const b = prev[i]!
      const c = i >= 4 ? prev[i - 4]! : 0
      const p = a + b - c
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]!
      row[i] = (row[i]! + predictor) & 0xff
    }
    rows.push(row)
  }
  return { width, rows }
}

/** The distinct RGBA colours of an 8-bit RGBA PNG, as `rrggbbaa` strings. */
function colours(png: Buffer): Set<string> {
  const seen = new Set<string>()
  for (const row of decode(png).rows) for (let i = 0; i < row.length; i += 4) seen.add(row.subarray(i, i + 4).toString('hex'))
  return seen
}

describe('PWA icons', () => {
  it('are the cooking pot rendered from its SVGs at every size the manifest lists, maskable included', () => {
    expect(manifest.icons!.length).toBe(4)
    for (const icon of manifest.icons!) {
      expect(readFileSync(`public/${icon.src}`).equals(renderIcon(icon)), icon.src).toBe(true)
    }
  })

  it('are never a single flat colour: the glyph stands out from the seed', () => {
    for (const icon of manifest.icons!) {
      expect(colours(readFileSync(`public/${icon.src}`)).size, icon.src).toBeGreaterThan(1)
    }
  })

  it('draw the glyph in the on-primary colour over the seed', () => {
    const [r, g, b] = Buffer.from(SEED.slice(1), 'hex')
    expect(g).toBeGreaterThan(r!)
    expect(g).toBeGreaterThan(b!)
    for (const icon of manifest.icons!) {
      const seen = colours(readFileSync(`public/${icon.src}`))
      expect(seen, icon.src).toContain(seedPixel)
      expect(seen, icon.src).toContain(glyphPixel)
    }
  })

  it('keep the maskable glyph inside the 80% safe zone: everything outside that circle is the seed', () => {
    for (const icon of manifest.icons!.filter((i) => i.purpose === 'maskable')) {
      const { width, rows } = decode(readFileSync(`public/${icon.src}`))
      const centre = width / 2
      let glyph = 0
      rows.forEach((row, y) => {
        for (let x = 0; x < width; x++) {
          const inside = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) <= 0.4 * width
          const pixel = row.subarray(x * 4, x * 4 + 4).toString('hex')
          if (inside && pixel !== seedPixel) glyph++
          if (!inside) expect(pixel, `${icon.src} at ${x},${y}`).toBe(seedPixel)
        }
      })
      expect(glyph, icon.src).toBeGreaterThan(0)
    }
  })
})
