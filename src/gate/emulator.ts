import { firebaseWebConfig, type FirebaseWebConfig, type LocalKit } from 'data-platform/client'
import { LOCAL_PROJECT_ID, localKit } from 'data-platform/local'

/** The Vite mode (`vite --mode emulator`) that runs the app against the local kit; `npm run ux` serves it, and `dev:local` in package.json must name the same mode. */
export const EMULATOR_MODE = 'emulator'

/**
 * The local kit in the `emulator` Vite mode, or `undefined` in every other mode, so `initFirebase`
 * wires nothing local. The mode check is inline so a production build folds it away along with the kit.
 */
export function emulatorKit(): LocalKit | undefined {
  return import.meta.env.MODE === EMULATOR_MODE ? localKit : undefined
}

/**
 * The config for the `emulator` Vite mode, or `null` in every other mode: it names the local kit's
 * demo project and carries no real key. The mode check is inline so a production build folds it
 * away along with the kit.
 */
export function emulatorConfig(): FirebaseWebConfig | null {
  if (import.meta.env.MODE !== EMULATOR_MODE) return null
  return firebaseWebConfig({
    apiKey: 'local',
    authDomain: `${LOCAL_PROJECT_ID}.firebaseapp.com`,
    projectId: LOCAL_PROJECT_ID,
    storageBucket: `${LOCAL_PROJECT_ID}.appspot.com`,
    messagingSenderId: '0',
    appId: '1:0:web:local',
  })
}
