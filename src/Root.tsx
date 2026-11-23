import type { Firestore } from 'firebase/firestore'
import { useMemo, useState } from 'preact/hooks'
import { initFirebase, saveFirebaseWebConfig, type FirebaseWebConfig, type LocalKit } from 'data-platform/client'
import { AuthGate } from './gate/AuthGate.tsx'
import { resolveConfig, type ConfigResolution } from './gate/config.ts'
import { emulatorConfig, emulatorKit } from './gate/emulator.ts'
import { PlatformGuard } from './gate/PlatformGuard.tsx'
import { SetupScreen } from './gate/SetupScreen.tsx'
import { App } from './App.tsx'
import { firestoreItemsPort } from './items/firestore-items-port.ts'
import { firestoreRecipeStore } from './recipes/recipe-store.ts'
import { AlertBanner } from 'household-ui/ui/AlertBanner.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { CentredCard } from 'household-ui/ui/CentredCard.tsx'

type RootState = Pick<ConfigResolution, 'config' | 'error' | 'proposed'> & { kit: LocalKit | undefined }

/** Resolves the config once, before first paint, and strips a consumed `#config=` fragment. */
function initialState(): RootState {
  const emulator = emulatorConfig()
  const kit = emulatorKit()
  if (emulator !== null) return { config: emulator, error: null, proposed: null, kit }
  const { config, error, proposed, consumed } = resolveConfig(location.hash)
  if (consumed) history.replaceState(null, '', location.pathname + location.search)
  return { config, error, proposed, kit: undefined }
}

/** The app's entry: config, then sign-in and membership, then the app. */
export function Root() {
  const [{ config, error, proposed, kit }, setState] = useState(initialState)

  if (proposed !== null) {
    return (
      <CentredCard appName="Recipes" title="Switch Household?">
        <p>
          This link carries the config of another Firebase project (<code>{proposed.projectId}</code>). Accepting it
          also repoints the Catalogue on this device.
        </p>
        <Button
          variant="filled"
          onClick={() => {
            saveFirebaseWebConfig(proposed)
            setState({ config: proposed, error: null, proposed: null, kit })
          }}
        >
          Switch to {proposed.projectId}
        </Button>
        <Button variant="tonal" onClick={() => setState({ config, error: null, proposed: null, kit })}>
          Keep the current Household
        </Button>
      </CentredCard>
    )
  }

  if (config === null) {
    return (
      <SetupScreen
        initialError={error}
        onConfigured={(next) => {
          saveFirebaseWebConfig(next)
          setState({ config: next, error: null, proposed: null, kit })
        }}
      />
    )
  }
  return (
    <>
      {error !== null && (
        <AlertBanner
          message={`${error} The link was ignored.`}
          onDismiss={() => setState({ config, error: null, proposed: null, kit })}
        />
      )}
      <Connected config={config} kit={kit} />
    </>
  )
}

function Connected({ config, kit }: { config: FirebaseWebConfig; kit: LocalKit | undefined }) {
  const client = useMemo(() => initFirebase(config, { local: kit }), [config, kit])
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
