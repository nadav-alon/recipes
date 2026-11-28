import { render, screen, waitFor } from '@testing-library/preact'
import { fireEvent } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirebaseClient } from 'data-platform/client'

const mocks = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void),
  signIn: vi.fn(),
  signOut: vi.fn(),
  householdExists: vi.fn(),
  isHouseholdMember: vi.fn(),
}))

vi.mock('data-platform/client', () => ({
  authClient: () => ({
    onAuthChange: (listener: (user: unknown) => void) => {
      mocks.listener = listener
      return () => {}
    },
    signIn: mocks.signIn,
    signOut: mocks.signOut,
  }),
  householdExists: mocks.householdExists,
  isHouseholdMember: mocks.isHouseholdMember,
}))

import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { AccountAction } from './account.tsx'
import { AuthGate } from './AuthGate.tsx'

const client = { app: {}, db: {} } as FirebaseClient
const user = { uid: 'u1', email: 'a@example.com' }

function renderGate() {
  render(
    <AuthGate client={client}>
      <p>the app</p>
    </AuthGate>,
  )
}

beforeEach(() => {
  mocks.listener = null
  mocks.signIn.mockReset()
  mocks.signOut.mockReset()
  mocks.householdExists.mockReset().mockResolvedValue(true)
  mocks.isHouseholdMember.mockReset().mockResolvedValue(true)
})

describe('AuthGate', () => {
  it('shows a Google sign-in screen when signed out', async () => {
    renderGate()
    mocks.listener!(null)
    await screen.findByRole('button', { name: /sign in with google/i })
    expect(screen.getByText(/what you can cook/i)).toBeInTheDocument()
  })

  it('signs in from a household-ui filled Button', async () => {
    renderGate()
    mocks.listener!(null)
    const button = await screen.findByRole('button', { name: /sign in with google/i })
    expect(button).toHaveClass('ui-button', 'ui-button--filled')
    fireEvent.click(button)
    expect(mocks.signIn).toHaveBeenCalled()
    expect(screen.queryByText('the app')).toBeNull()
  })

  it('lets a Member through to the app', async () => {
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByText('the app')).toBeInTheDocument()
  })

  it('sends a signed-in non-Member to the Catalogue to join', async () => {
    mocks.isHouseholdMember.mockResolvedValue(false)
    renderGate()
    mocks.listener!(user)
    const link = await screen.findByRole('link', { name: /catalogue/i })
    expect(link).toHaveAttribute('href', '/home-catalogue/')
    expect(screen.getByText(/join through the catalogue/i)).toBeInTheDocument()
    expect(screen.queryByText('the app')).toBeNull()
  })

  it('points the link at VITE_CATALOGUE_URL when set', async () => {
    vi.stubEnv('VITE_CATALOGUE_URL', 'http://localhost:5173/home-catalogue/')
    mocks.isHouseholdMember.mockResolvedValue(false)
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByRole('link', { name: /catalogue/i })).toHaveAttribute(
      'href',
      'http://localhost:5173/home-catalogue/',
    )
    vi.unstubAllEnvs()
  })

  it('sends a signed-in user to the Catalogue to claim when the Household is unclaimed', async () => {
    mocks.householdExists.mockResolvedValue(false)
    renderGate()
    mocks.listener!(user)
    const title = await screen.findByRole('heading', { name: /not claimed/i })
    expect(screen.getByRole('main')).toContainElement(title)
    expect(screen.queryByRole('banner')).toBeNull()
    const link = screen.getByRole('link', { name: /catalogue/i })
    expect(link).toHaveAttribute('href', '/home-catalogue/')
    expect(link).toHaveClass('ui-button', 'ui-button--filled')
    expect(mocks.isHouseholdMember).not.toHaveBeenCalled()
  })

  it('offers a retry when the Household cannot be reached', async () => {
    mocks.householdExists.mockRejectedValueOnce(new Error('offline'))
    renderGate()
    mocks.listener!(user)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('the app')).toBeInTheDocument())
  })

  it('shows Retry as a household-ui filled Button', async () => {
    mocks.householdExists.mockRejectedValue(new Error('offline'))
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByRole('button', { name: 'Retry' })).toHaveClass('ui-button', 'ui-button--filled')
  })
})

describe('AuthGate first membership check', () => {
  it('shows a named progressbar, not an empty screen, while the check is pending', async () => {
    mocks.householdExists.mockReturnValue(new Promise(() => {}))
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByRole('progressbar', { name: 'Checking your Household' })).toBeInTheDocument()
  })

  it('does not claim to check the Household before anyone is known to be signed in', () => {
    renderGate()
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: 'Checking your Household' })).toBeNull()
  })

  it('shows the progressbar, not the Sign in screen, while the check after signing in is pending', async () => {
    renderGate()
    mocks.listener!(null)
    await screen.findByRole('button', { name: /sign in with google/i })
    mocks.householdExists.mockReturnValue(new Promise(() => {}))
    mocks.listener!(user)
    expect(await screen.findByRole('progressbar', { name: 'Checking your Household' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in with google/i })).toBeNull()
  })
})

describe('AuthGate Retry from the Unreachable card', () => {
  async function unreachable() {
    mocks.householdExists.mockRejectedValueOnce(new Error('offline'))
    renderGate()
    mocks.listener!(user)
    return await screen.findByRole('button', { name: 'Retry' })
  }

  function pendingLookup() {
    let settle!: (exists: boolean) => void
    mocks.householdExists.mockReturnValueOnce(new Promise<boolean>((r) => (settle = r)))
    return settle
  }

  it('keeps the card up with Retry disabled and busy until the lookup resolves', async () => {
    const retry = await unreachable()
    const settle = pendingLookup()
    fireEvent.click(retry)
    expect(screen.getByRole('heading', { name: /couldn't reach/i })).toBeInTheDocument()
    const busy = screen.getByRole('button', { name: /retry/i })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    settle(true)
    expect(await screen.findByText('the app')).toBeInTheDocument()
  })

  it('leaves Retry enabled when the retry fails again', async () => {
    const retry = await unreachable()
    mocks.householdExists.mockRejectedValueOnce(new Error('still offline'))
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled())
    expect(screen.getByRole('heading', { name: /couldn't reach/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).not.toHaveAttribute('aria-busy', 'true')
  })

  it('moves to the Not a Member card when the retry finds a non-Member', async () => {
    const retry = await unreachable()
    mocks.isHouseholdMember.mockResolvedValue(false)
    fireEvent.click(retry)
    expect(await screen.findByRole('heading', { name: /not a member/i })).toBeInTheDocument()
  })

  it('keeps Sign out usable while busy, and a lookup resolving after sign-out changes nothing', async () => {
    const retry = await unreachable()
    const settle = pendingLookup()
    fireEvent.click(retry)
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    expect(signOut).toBeEnabled()
    fireEvent.click(signOut)
    expect(mocks.signOut).toHaveBeenCalledOnce()
    mocks.listener!(null)
    await screen.findByRole('button', { name: /sign in with google/i })
    settle(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('the app')).toBeNull()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('ignores a lookup that settles between the Sign out tap and the auth callback', async () => {
    const retry = await unreachable()
    const settle = pendingLookup()
    fireEvent.click(retry)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    settle(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('the app')).toBeNull()
  })
})

describe('AuthGate screens before a Household is open', () => {
  it.each([
    ['unclaimed', () => mocks.householdExists.mockResolvedValue(false), /not claimed/i],
    ['non-Member', () => mocks.isHouseholdMember.mockResolvedValue(false), /not a member/i],
    ['unreachable', () => mocks.householdExists.mockRejectedValue(new Error('offline')), /couldn't reach/i],
  ])('sit on a CentredCard, with no top app bar, when %s', async (_name, arrange, heading) => {
    arrange()
    renderGate()
    mocks.listener!(user)
    const title = await screen.findByRole('heading', { name: heading })
    expect(title.closest('.ui-centred-card')).not.toBeNull()
    expect(screen.queryByRole('banner')).toBeNull()
  })
})

describe('AuthGate Sign out', () => {
  it.each([
    ['unclaimed', () => mocks.householdExists.mockResolvedValue(false)],
    ['non-Member', () => mocks.isHouseholdMember.mockResolvedValue(false)],
    ['unreachable', () => mocks.householdExists.mockRejectedValue(new Error('offline'))],
  ])('is a household-ui Button when %s', async (_name, arrange) => {
    arrange()
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByRole('button', { name: 'Sign out' })).toHaveClass('ui-button')
  })
})

describe('AuthGate account', () => {
  it('tells what it lets in who is signed in and how to sign out', async () => {
    render(
      <AuthGate client={client}>
        <TopAppBar title="Home">
          <AccountAction />
        </TopAppBar>
      </AuthGate>,
    )
    mocks.listener!(user)
    fireEvent.click(await screen.findByRole('button', { name: 'Account' }))
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
    mocks.listener!(null)
    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })
})
