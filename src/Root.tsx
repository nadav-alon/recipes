import { useMemo, useState } from 'preact/hooks'
import { initFirebase, saveFirebaseWebConfig, type FirebaseWebConfig } from 'data-platform/client'
import { AuthGate } from './gate/AuthGate.tsx'
import { resolveConfig } from './gate/config.ts'
import { localConfig } from './gate/local.ts'
import { PlatformGuard } from './gate/PlatformGuard.tsx'
import { SetupScreen } from './gate/SetupScreen.tsx'
import { App } from './App.tsx'

type RootState = { config: FirebaseWebConfig | null; setupError: string | null }

/** Resolves the config once, before first paint, and strips a consumed `#config=` fragment. */
function initialState(): RootState {
  const local = localConfig()
  if (local !== null) return { config: local, setupError: null }
  const { config, error } = resolveConfig(location.hash)
  if (location.hash.startsWith('#config=')) {
    history.replaceState(null, '', location.pathname + location.search)
  }
  return { config, setupError: error }
}

/** The app's entry: config, then sign-in and membership, then the app. */
export function Root() {
  const [{ config, setupError }, setState] = useState(initialState)

  if (config === null) {
    return (
      <SetupScreen
        initialError={setupError}
        onConfigured={(next) => {
          saveFirebaseWebConfig(next)
          setState({ config: next, setupError: null })
        }}
      />
    )
  }
  return <Connected config={config} />
}

function Connected({ config }: { config: FirebaseWebConfig }) {
  const client = useMemo(() => initFirebase(config, { local: localConfig() !== null }), [config])
  return (
    <AuthGate client={client}>
      <PlatformGuard db={client.db} />
      <App />
    </AuthGate>
  )
}
