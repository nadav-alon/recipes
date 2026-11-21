import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import {
  authClient,
  householdExists,
  isHouseholdMember,
  type AuthUser,
  type FirebaseClient,
} from 'data-platform/client'

/** The Catalogue shares this origin; it is where a Household is claimed and joined. */
const DEFAULT_CATALOGUE_URL = '/home-catalogue/'

/**
 * Where the Catalogue lives. It shares this origin when deployed; set `VITE_CATALOGUE_URL` where it
 * does not, as under `vite --mode local`.
 */
export function catalogueUrl(): string {
  return import.meta.env.VITE_CATALOGUE_URL || DEFAULT_CATALOGUE_URL
}

export type AuthGateProps = {
  client: FirebaseClient
  children: ComponentChildren
}

type GateState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'unclaimed'; user: AuthUser }
  | { status: 'non-member'; user: AuthUser }
  | { status: 'unreachable'; user: AuthUser }
  | { status: 'member' }

/**
 * Gates `children` behind Google sign-in and Household membership. This app never claims a
 * Household nor joins one: it sends a user who can't get in to the Catalogue.
 */
export function AuthGate({ client, children }: AuthGateProps) {
  const [state, setState] = useState<GateState>({ status: 'checking' })
  const auth = useMemo(() => authClient(client.app), [client])
  /** Bumped on every lookup, sign-out and unmount, so only the latest lookup may set state. */
  const generation = useRef(0)

  const resolveMembership = useCallback(
    async (user: AuthUser) => {
      const mine = ++generation.current
      const setIfCurrent = (next: GateState) => {
        if (mine === generation.current) setState(next)
      }
      try {
        if (!(await householdExists(client.db))) return setIfCurrent({ status: 'unclaimed', user })
        const member = await isHouseholdMember(client.db, user.uid)
        setIfCurrent(member ? { status: 'member' } : { status: 'non-member', user })
      } catch {
        setIfCurrent({ status: 'unreachable', user })
      }
    },
    [client],
  )

  useEffect(() => {
    const unwatch = auth.onAuthChange((user) => {
      if (user === null) {
        generation.current++
        setState({ status: 'signed-out' })
        return
      }
      void resolveMembership(user)
    })
    return () => {
      generation.current++
      unwatch()
    }
  }, [auth, resolveMembership])

  switch (state.status) {
    case 'checking':
      return null

    case 'signed-out':
      return (
        <main>
          <h1>Sign in</h1>
          <button onClick={() => void auth.signIn()}>Sign in with Google</button>
        </main>
      )

    case 'unclaimed':
      return (
        <main>
          <h1>Household not claimed</h1>
          <p>No one has claimed this Household yet. Claim it through the Catalogue.</p>
          <CatalogueLink />
          <SignOutButton onClick={() => void auth.signOut()} />
        </main>
      )

    case 'non-member':
      return (
        <main>
          <h1>Not a Member</h1>
          <p>Signed in as {state.user.email}, who is not a Member of this Household.</p>
          <p>Join through the Catalogue, then come back.</p>
          <CatalogueLink />
          <SignOutButton onClick={() => void auth.signOut()} />
        </main>
      )

    case 'unreachable':
      return (
        <main>
          <h1>Couldn't reach your Household</h1>
          <p>Check your connection and try again.</p>
          <button
            onClick={() => {
              setState({ status: 'checking' })
              void resolveMembership(state.user)
            }}
          >
            Retry
          </button>
          <SignOutButton onClick={() => void auth.signOut()} />
        </main>
      )

    case 'member':
      return <>{children}</>
  }
}

function CatalogueLink() {
  return (
    <p>
      <a href={catalogueUrl()}>Open the Catalogue</a>
    </p>
  )
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Sign out</button>
}
