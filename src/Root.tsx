import type { Firestore } from 'firebase/firestore'
import { useMemo, useState } from 'preact/hooks'
import { initFirebase, saveFirebaseWebConfig, type FirebaseWebConfig } from 'data-platform/client'
import { AuthGate } from './gate/AuthGate.tsx'
import { resolveConfig, type ConfigResolution } from './gate/config.ts'
import { localConfig } from './gate/local.ts'
import { PlatformGuard } from './gate/PlatformGuard.tsx'
import { SetupScreen } from './gate/SetupScreen.tsx'
import { App } from './App.tsx'
import { firestoreItemsPort } from './items/firestore-items-port.ts'
import { firestoreRecipeStore } from './recipes/recipe-store.ts'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'

type RootState = Pick<ConfigResolution, 'config' | 'error' | 'proposed'> & { local: boolean }

/** Resolves the config once, before first paint, and strips a consumed `#config=` fragment. */
function initialState(): RootState {
  const local = localConfig()
  if (local !== null) return { config: local, error: null, proposed: null, local: true }
  const { config, error, proposed, consumed } = resolveConfig(location.hash)
  if (consumed) history.replaceState(null, '', location.pathname + location.search)
  return { config, error, proposed, local: false }
}

/** The app's entry: config, then sign-in and membership, then the app. */
export function Root() {
  const [{ config, error, proposed, local }, setState] = useState(initialState)

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
              setState({ config: proposed, error: null, proposed: null, local })
            }}
          >
            Switch to {proposed.projectId}
          </button>
          <button onClick={() => setState({ config, error: null, proposed: null, local })}>
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
          setState({ config: next, error: null, proposed: null, local })
        }}
      />
    )
  }
  return (
    <>
      {error !== null && (
        <div role="alert">
          <p>{error} The link was ignored.</p>
          <button onClick={() => setState({ config, error: null, proposed: null, local })}>Dismiss</button>
        </div>
      )}
      <Connected config={config} local={local} />
    </>
  )
}

function Connected({ config, local }: { config: FirebaseWebConfig; local: boolean }) {
  const client = useMemo(() => initFirebase(config, { local }), [config, local])
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
