import { describe, expect, it } from 'vitest'
import { FIREBASE_CONFIG_STORAGE_KEY } from 'data-platform/client'
import { parseConfigText, resolveConfig } from './config.ts'

const config = {
  apiKey: 'k',
  authDomain: 'a.firebaseapp.com',
  projectId: 'p',
  storageBucket: 'p.appspot.com',
  messagingSenderId: '1',
  appId: '1:1:web:x',
}

function memoryStorage(initial?: unknown) {
  const items = new Map<string, string>()
  if (initial !== undefined) items.set(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function transferHash(value: unknown) {
  return `#config=${btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

describe('resolveConfig', () => {
  it('reads the config the Catalogue stored', () => {
    expect(resolveConfig('', memoryStorage(config))).toMatchObject({ config, error: null })
  })

  it('has no config when none is stored', () => {
    expect(resolveConfig('', memoryStorage())).toMatchObject({ config: null, error: null })
  })

  it('stores and uses the config from a #config= link', () => {
    const storage = memoryStorage()
    expect(resolveConfig(transferHash(config), storage)).toMatchObject({ config, error: null })
    expect(resolveConfig('', storage).config).toEqual(config)
  })

  it('reports a corrupted link and keeps the stored config', () => {
    const result = resolveConfig('#config=!!!', memoryStorage(config))
    expect(result.config).toEqual(config)
    expect(result.error).toMatch(/truncated or corrupted/)
  })
})

describe('parseConfigText', () => {
  it('accepts a JSON config', () => {
    expect(parseConfigText(JSON.stringify(config))).toEqual(config)
  })

  it('accepts the object literal from the Firebase console snippet', () => {
    const snippet = `const firebaseConfig = {
      apiKey: "k",
      authDomain: "a.firebaseapp.com",
      projectId: "p",
      storageBucket: "p.appspot.com",
      messagingSenderId: "1",
      appId: "1:1:web:x",
    };`
    expect(parseConfigText(snippet)).toEqual(config)
  })

  it('names what is wrong with an incomplete config', () => {
    expect(() => parseConfigText('{"apiKey":"k"}')).toThrow(/missing or has empty fields/)
  })

  it('rejects text that is not a config at all', () => {
    expect(() => parseConfigText('hello')).toThrow(/not a Firebase config/)
  })
})

describe('resolveConfig and an existing config', () => {
  const other = { ...config, projectId: 'other' }

  it('holds back a link whose config differs from the stored one', () => {
    const storage = memoryStorage(config)
    const result = resolveConfig(transferHash(other), storage)
    expect(result).toEqual({ config, error: null, consumed: true, proposed: other })
    expect(resolveConfig('', storage).config).toEqual(config)
  })

  it('applies a link whose config equals the stored one', () => {
    const result = resolveConfig(transferHash(config), memoryStorage(config))
    expect(result).toEqual({ config, error: null, consumed: true, proposed: null })
  })

  it('reports that a refused link was consumed', () => {
    expect(resolveConfig('#config=!!!', memoryStorage()).consumed).toBe(true)
    expect(resolveConfig('#other', memoryStorage()).consumed).toBe(false)
  })
})

describe('parseConfigText limits', () => {
  it('accepts a #config= link, or a URL holding one', () => {
    expect(parseConfigText(transferHash(config))).toEqual(config)
    expect(parseConfigText(`https://x.test/recipes/${transferHash(config)}`)).toEqual(config)
  })

  it('reports a corrupted pasted link', () => {
    expect(() => parseConfigText('#config=!!!')).toThrow(/truncated or corrupted/)
  })

  it('refuses a single-quoted snippet', () => {
    const snippet = `const firebaseConfig = { apiKey: 'k', authDomain: 'a.firebaseapp.com' };`
    expect(() => parseConfigText(snippet)).toThrow(/not a Firebase config/)
  })

  it('refuses a snippet with comments', () => {
    const snippet = `{ // from the console\n apiKey: "k" }`
    expect(() => parseConfigText(snippet)).toThrow(/not a Firebase config/)
  })
})
