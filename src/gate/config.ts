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
}

/**
 * The config the Catalogue stored on this origin, or the one in a `#config=` device-transfer link,
 * which is stored so the next load finds it. A link that fails to parse leaves the stored config alone.
 */
export function resolveConfig(hash: string, storage: ConfigStorage = localStorage): ConfigResolution {
  const stored = getStoredFirebaseWebConfig(storage)
  try {
    const incoming = parseConfigFragment(hash)
    if (incoming === null) return { config: stored, error: null }
    saveFirebaseWebConfig(incoming, storage)
    return { config: incoming, error: null }
  } catch (error) {
    if (error instanceof InvalidFirebaseWebConfigError) return { config: stored, error: error.message }
    throw error
  }
}

/**
 * A config pasted into the setup screen: JSON, or the object literal of the snippet the Firebase
 * console shows. Throws an `Error` whose message is fit to show the user.
 */
export function parseConfigText(text: string): FirebaseWebConfig {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end < start) throw new Error('That is not a Firebase config.')
  const literal = text
    .slice(start, end + 1)
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
    .replace(/,\s*}/g, '}')
  let value: unknown
  try {
    value = JSON.parse(literal)
  } catch {
    throw new Error('That is not a Firebase config.')
  }
  return firebaseWebConfig(value)
}
