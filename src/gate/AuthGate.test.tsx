import { render, screen, waitFor } from '@testing-library/preact'
import { fireEvent } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FirebaseClient } from 'data-platform/client'

const mocks = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void),
  signIn: vi.fn(),
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
    signOut: vi.fn(),
  }),
  householdExists: mocks.householdExists,
  isHouseholdMember: mocks.isHouseholdMember,
}))

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
  mocks.householdExists.mockReset().mockResolvedValue(true)
  mocks.isHouseholdMember.mockReset().mockResolvedValue(true)
})

describe('AuthGate', () => {
  it('shows a Google sign-in screen when signed out', async () => {
    renderGate()
    mocks.listener!(null)
    fireEvent.click(await screen.findByRole('button', { name: /sign in with google/i }))
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

  it('sends a signed-in user to the Catalogue to claim when the Household is unclaimed', async () => {
    mocks.householdExists.mockResolvedValue(false)
    renderGate()
    mocks.listener!(user)
    expect(await screen.findByRole('heading', { name: /not claimed/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /catalogue/i })).toHaveAttribute('href', '/home-catalogue/')
    expect(mocks.isHouseholdMember).not.toHaveBeenCalled()
  })

  it('offers a retry when the Household cannot be reached', async () => {
    mocks.householdExists.mockRejectedValueOnce(new Error('offline'))
    renderGate()
    mocks.listener!(user)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('the app')).toBeInTheDocument())
  })
})
