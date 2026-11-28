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
import { CentredCard } from 'household-ui/ui/CentredCard.tsx'
import { MemberContext, SignOutButton } from './account.tsx'
import { ProgressIndicator } from '../shell/ProgressIndicator.tsx'
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
  | { status: 'unreachable'; user: AuthUser; retrying: boolean }
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
        setIfCurrent({ status: 'unreachable', user, retrying: false })
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
      return (
        <main class="gate-progress">
          <ProgressIndicator label="Checking your Household" />
        </main>
      )

    case 'signed-out':
      return (
        <TopAppBar title="Sign in">
          <main class="screen sign-in">
            <p>Recipes: what you can cook from what's at home.</p>
            <Button variant="filled" onClick={() => void auth.signIn()}>
              Sign in with Google
            </Button>
          </main>
        </TopAppBar>
      )

    case 'unclaimed':
      return (
        <CentredCard appName="Recipes" title="Household not claimed">
          <p>No one has claimed this Household yet. Claim it through the Catalogue.</p>
          <CatalogueLink />
          <SignOutButton onClick={signOut} />
        </CentredCard>
      )

    case 'non-member':
      return (
        <CentredCard appName="Recipes" title="Not a Member">
          <p>Signed in as {state.user.email}, who is not a Member of this Household.</p>
          <p>Join through the Catalogue, then come back.</p>
          <CatalogueLink />
          <SignOutButton onClick={signOut} />
        </CentredCard>
      )

    case 'unreachable':
      return (
        <CentredCard appName="Recipes" title="Couldn't reach your Household">
          <p>Check your connection and try again.</p>
          <Button
            variant="filled"
            disabled={state.retrying}
            aria-busy={state.retrying}
            onClick={() => {
              setState({ ...state, retrying: true })
              void resolveMembership(state.user)
            }}
          >
            Retry
          </Button>
          {state.retrying && <ProgressIndicator label="Checking your Household" />}
          <SignOutButton onClick={signOut} />
        </CentredCard>
      )

    case 'member':
      return (
        <MemberContext.Provider value={{ email: state.user.email, signOut }}>
          {children}
        </MemberContext.Provider>
      )
  }
}

function CatalogueLink() {
  return (
    <a href={catalogueUrl()} class="ui-button ui-button--filled">
      Open the Catalogue
    </a>
  )
}
