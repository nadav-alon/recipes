import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { iconSpecs } from './pwa-icons.ts'
import { manifest, versionedIconSrc } from './pwa-manifest.ts'
import { SEED } from './seed.ts'

describe('PWA manifest', () => {
  it('is installable: standalone with a 192 and a 512 icon that exist', () => {
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons!.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const { file } of iconSpecs) expect(existsSync(join('public', file))).toBe(true)
  })
})

describe('icon versioning', () => {
  const versionedSrcFor = (bytes: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'recipes-icon-'))
    writeFileSync(join(dir, 'pwa-192x192.png'), bytes)
    return versionedIconSrc('pwa-192x192.png', dir)
  }

  it('changes the URL when the icon bytes change and keeps it when they do not', () => {
    expect(versionedSrcFor('pot')).toBe(versionedSrcFor('pot'))
    expect(versionedSrcFor('pot')).not.toBe(versionedSrcFor('square'))
  })

  it('versions by the first 8 hex of the content sha256', () => {
    const hash = createHash('sha256').update('pot').digest('hex').slice(0, 8)
    expect(versionedSrcFor('pot')).toBe(`pwa-192x192.png?v=${hash}`)
  })

  it('pins every manifest icon URL to the bytes of the file it names', () => {
    expect(manifest.icons!.map((i) => i.src)).toEqual(
      iconSpecs.map(({ file }) => `${file}?v=${createHash('sha256').update(readFileSync(join('public', file))).digest('hex').slice(0, 8)}`),
    )
  })
})

describe('production build', () => {
  it('serves the app under /recipes/ with a service worker precaching the shell', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recipes-build-'))
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { stdio: 'pipe' })
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(html).toContain('/recipes/assets/')
    const favicon = html.match(/<link rel="icon"[^>]*href="\/recipes\/([^"]+)"/)?.[1]
    expect(favicon).toBe(manifest.icons!.find((i) => i.sizes === '192x192' && !i.purpose)!.src)
    expect(html).toContain(`<meta name="theme-color" content="${SEED}">`)
    expect(readdirSync(outDir)).toContain('manifest.webmanifest')
    const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
    expect(sw).toContain('index.html')
    for (const { file } of iconSpecs) expect(sw, file).toContain(`"${file}"`)
    expect(sw).toContain('ignoreURLParametersMatching')
  }, 60_000)
})
