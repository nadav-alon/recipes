import {
  firebaseWebConfig,
  getStoredFirebaseWebConfig,
  InvalidFirebaseWebConfigError,
  parseConfigFragment,
  saveFirebaseWebConfig,
  type ConfigStorage,
  type FirebaseWebConfig,
} from 'data-platform/client'

export type ConfigResolution = {
  /** The config to run under, or `null` when the setup screen must collect one. */
  readonly config: FirebaseWebConfig | null
  /** Why a `#config=` link was refused; the stored config, if any, is still in `config`. */
  readonly error: string | null
  /** Whether `hash` held a `#config=` link, accepted or refused, so the caller can strip it. */
  readonly consumed: boolean
  /**
   * A link's config that differs from the stored one. It is not saved: accepting it repoints every
   * app on this origin, the Catalogue included, so the caller asks first and then `acceptConfig`s.
   */
  readonly proposed: FirebaseWebConfig | null
}

const NOT_A_CONFIG = 'That is not a Firebase config.'

/**
 * The config the Catalogue stored on this origin, or the one in a `#config=` device-transfer link,
 * which is stored so the next load finds it. A link that fails to parse leaves the stored config
 * alone, and so does one that differs from it: that is returned as `proposed` until accepted.
 */
export function resolveConfig(hash: string, storage: ConfigStorage = localStorage): ConfigResolution {
  const stored = getStoredFirebaseWebConfig(storage)
  try {
    const incoming = parseConfigFragment(hash)
    if (incoming === null) return { config: stored, error: null, consumed: false, proposed: null }
    if (stored !== null && !sameConfig(stored, incoming)) {
      return { config: stored, error: null, consumed: true, proposed: incoming }
    }
    saveFirebaseWebConfig(incoming, storage)
    return { config: incoming, error: null, consumed: true, proposed: null }
  } catch (error) {
    if (error instanceof InvalidFirebaseWebConfigError) {
      return { config: stored, error: error.message, consumed: true, proposed: null }
    }
    throw error
  }
}

function sameConfig(a: FirebaseWebConfig, b: FirebaseWebConfig): boolean {
  return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
}

/**
 * A config pasted into the setup screen: a `#config=` link or URL, JSON, or the object literal of
 * the snippet the Firebase console shows. Throws an `Error` whose message is fit to show the user.
 *
 * The literal is read with regexes, so it must use double-quoted strings, no comments and no `}`
 * inside a value; anything else is refused as not a config.
 */
export function parseConfigText(text: string): FirebaseWebConfig {
  const link = text.indexOf('#config=')
  if (link !== -1) {
    try {
      const fromLink = parseConfigFragment(text.slice(link).trim())
      if (fromLink !== null) return fromLink
    } catch (error) {
      if (error instanceof InvalidFirebaseWebConfigError) throw new Error(error.message)
      throw error
    }
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end < start) throw new Error(NOT_A_CONFIG)
  const literal = text
    .slice(start, end + 1)
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
    .replace(/,\s*}/g, '}')
  let value: unknown
  try {
    value = JSON.parse(literal)
  } catch {
    throw new Error(NOT_A_CONFIG)
  }
  return firebaseWebConfig(value)
}
