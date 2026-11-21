import { firebaseWebConfig, type FirebaseWebConfig } from 'data-platform/client'
import { LOCAL_PROJECT_ID } from 'data-platform/local'

/**
 * The config for the `local` Vite mode, or `null` in every other mode: it names the local kit's
 * demo project and carries no real key. The mode check is inline so a production build folds it
 * away along with the kit.
 */
export function localConfig(): FirebaseWebConfig | null {
  if (import.meta.env.MODE !== 'local') return null
  return firebaseWebConfig({
    apiKey: 'local',
    authDomain: `${LOCAL_PROJECT_ID}.firebaseapp.com`,
    projectId: LOCAL_PROJECT_ID,
    storageBucket: `${LOCAL_PROJECT_ID}.appspot.com`,
    messagingSenderId: '0',
    appId: '1:0:web:local',
  })
}
