import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { manifest } from './pwa-manifest.ts'
import { SEED } from './seed.ts'

describe('PWA manifest', () => {
  it('is installable: standalone with a 192 and a 512 icon that exist', () => {
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons!.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const icon of manifest.icons!) {
      expect(existsSync(join('public', icon.src))).toBe(true)
    }
  })
})

describe('production build', () => {
  it('serves the app under /recipes/ with a service worker precaching the shell', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recipes-build-'))
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { stdio: 'pipe' })
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(html).toContain('/recipes/assets/')
    expect(html).toContain(`<meta name="theme-color" content="${SEED}">`)
    expect(readdirSync(outDir)).toContain('manifest.webmanifest')
    const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
    expect(sw).toContain('index.html')
  }, 60_000)
})

describe('favicon', () => {
  it('is the 192 manifest icon, which draws the cooking pot', () => {
    const href = readFileSync('index.html', 'utf8').match(/<link rel="icon"[^>]*href="\/([^"]+)"/)?.[1]
    expect(href).toBe(manifest.icons!.find((i) => i.sizes === '192x192' && !i.purpose)!.src)
  })
})
