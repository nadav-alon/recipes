import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import {
  authClient,
  householdExists,
  isHouseholdMember,
  type AuthUser,
  type FirebaseClient,
} from 'data-platform/client'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { AccountContext } from './account.tsx'
import { catalogueUrl } from '../catalogue-url.ts'

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
  | { status: 'member'; user: AuthUser }

/**
 * Gates `children` behind Google sign-in and Household membership. This app never claims a
 * Household nor joins one: it sends a user who can't get in to the Catalogue.
 */
export function AuthGate({ client, children }: AuthGateProps) {
  const [state, setState] = useState<GateState>({ status: 'checking' })
  const auth = useMemo(() => authClient(client.app), [client])
  const signOut = useCallback(() => void auth.signOut(), [auth])
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
        setIfCurrent(member ? { status: 'member', user } : { status: 'non-member', user })
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
        <TopAppBar title="Sign in">
          <main class="sign-in">
            <p>Recipes: what you can cook from what's at home.</p>
            <Button variant="filled" onClick={() => void auth.signIn()}>
              Sign in with Google
            </Button>
          </main>
        </TopAppBar>
      )

    case 'unclaimed':
      return (
        <TopAppBar title="Household not claimed">
          <main>
            <p>No one has claimed this Household yet. Claim it through the Catalogue.</p>
            <CatalogueLink />
            <SignOutButton onClick={signOut} />
          </main>
        </TopAppBar>
      )

    case 'non-member':
      return (
        <TopAppBar title="Not a Member">
          <main>
            <p>Signed in as {state.user.email}, who is not a Member of this Household.</p>
            <p>Join through the Catalogue, then come back.</p>
            <CatalogueLink />
            <SignOutButton onClick={signOut} />
          </main>
        </TopAppBar>
      )

    case 'unreachable':
      return (
        <TopAppBar title={"Couldn't reach your Household"}>
          <main>
            <p>Check your connection and try again.</p>
            <Button
              variant="filled"
              onClick={() => {
                setState({ status: 'checking' })
                void resolveMembership(state.user)
              }}
            >
              Retry
            </Button>
            <SignOutButton onClick={signOut} />
          </main>
        </TopAppBar>
      )

    case 'member':
      return (
        <AccountContext.Provider value={{ email: state.user.email, signOut }}>
          {children}
        </AccountContext.Provider>
      )
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
  return <Button variant="tonal" onClick={onClick}>Sign out</Button>
}
