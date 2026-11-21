import type { Firestore } from 'firebase/firestore'
import { useMemo, useState } from 'preact/hooks'
import { initFirebase, saveFirebaseWebConfig, type FirebaseWebConfig } from 'data-platform/client'
import { localKit } from 'data-platform/local'
import { AuthGate } from './gate/AuthGate.tsx'
import { resolveConfig, type ConfigResolution } from './gate/config.ts'
import { emulatorConfig } from './gate/emulator.ts'
import { PlatformGuard } from './gate/PlatformGuard.tsx'
import { SetupScreen } from './gate/SetupScreen.tsx'
import { App } from './App.tsx'
import { firestoreItemsPort } from './items/firestore-items-port.ts'
import { firestoreRecipeStore } from './recipes/recipe-store.ts'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'

type RootState = Pick<ConfigResolution, 'config' | 'error' | 'proposed'> & { emulator: boolean }

/** Resolves the config once, before first paint, and strips a consumed `#config=` fragment. */
function initialState(): RootState {
  const emulator = emulatorConfig()
  if (emulator !== null) return { config: emulator, error: null, proposed: null, emulator: true }
  const { config, error, proposed, consumed } = resolveConfig(location.hash)
  if (consumed) history.replaceState(null, '', location.pathname + location.search)
  return { config, error, proposed, emulator: false }
}

/** The app's entry: config, then sign-in and membership, then the app. */
export function Root() {
  const [{ config, error, proposed, emulator }, setState] = useState(initialState)

  if (proposed !== null) {
    return (
      <TopAppBar title="Switch Household?">
        <main>
          <p>
            This link carries the config of another Firebase project (<code>{proposed.projectId}</code>).
            Accepting it also repoints the Catalogue on this device.
          </p>
          <button
            onClick={() => {
              saveFirebaseWebConfig(proposed)
              setState({ config: proposed, error: null, proposed: null, emulator })
            }}
          >
            Switch to {proposed.projectId}
          </button>
          <button onClick={() => setState({ config, error: null, proposed: null, emulator })}>
            Keep the current Household
          </button>
        </main>
      </TopAppBar>
    )
  }

  if (config === null) {
    return (
      <SetupScreen
        initialError={error}
        onConfigured={(next) => {
          saveFirebaseWebConfig(next)
          setState({ config: next, error: null, proposed: null, emulator })
        }}
      />
    )
  }
  return (
    <>
      {error !== null && (
        <div role="alert">
          <p>{error} The link was ignored.</p>
          <button onClick={() => setState({ config, error: null, proposed: null, emulator })}>Dismiss</button>
        </div>
      )}
      <Connected config={config} emulator={emulator} />
    </>
  )
}

function Connected({ config, emulator }: { config: FirebaseWebConfig; emulator: boolean }) {
  const client = useMemo(() => initFirebase(config, { local: emulator ? localKit : undefined }), [config, emulator])
  return (
    <AuthGate client={client}>
      <PlatformGuard db={client.db} />
      <SignedIn db={client.db} />
    </AuthGate>
  )
}

/** The app once signed in; the stores are built here so nothing touches Firestore before the gate opens. */
function SignedIn({ db }: { db: Firestore }) {
  const recipeStore = useMemo(() => firestoreRecipeStore(db), [db])
  const itemsPort = useMemo(() => firestoreItemsPort(db), [db])
  return <App recipeStore={recipeStore} itemsPort={itemsPort} />
}
