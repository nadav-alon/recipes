import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colourRoleHex, colourRolesCss, seedColour } from 'household-ui/ui/colourRoles.ts'
import { manifest } from './pwa-manifest.ts'
import { SEED } from './seed.ts'

describe('theme', () => {
  it('has theme.css generated from the seed, following the system light/dark setting', () => {
    const css = readFileSync('src/theme.css', 'utf8')
    expect(css).toBe(colourRolesCss(seedColour(SEED)))
    expect(css).toContain('color-scheme: light dark')
  })

  it('takes the PWA manifest theme colour from the same seed', () => {
    expect(manifest.theme_color).toBe(SEED)
  })

  it("takes the PWA manifest's splash background from the theme's background role", () => {
    expect(manifest.background_color).toBe(colourRoleHex(seedColour(SEED), 'background', 'light'))
    expect(readFileSync('src/theme.css', 'utf8')).toContain(`--md-sys-color-background: ${manifest.background_color};`)
  })
})
