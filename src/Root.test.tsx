import { render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initFirebase: vi.fn(),
}))

vi.mock('data-platform/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('data-platform/client')>()),
  initFirebase: mocks.initFirebase,
  authClient: () => ({ onAuthChange: () => () => {}, signIn: vi.fn(), signOut: vi.fn() }),
}))

import { Root } from './Root.tsx'

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  mocks.initFirebase.mockReset().mockReturnValue({ app: {}, db: {} })
})

afterEach(() => vi.unstubAllEnvs())

describe('Root', () => {
  it('shows the setup screen when no config is stored', () => {
    render(<Root />)
    expect(screen.getByRole('heading', { name: 'Set up' })).toBeInTheDocument()
    expect(mocks.initFirebase).not.toHaveBeenCalled()
  })

  it('connects with the stored config and waits at the gate', () => {
    const config = {
      apiKey: 'k',
      authDomain: 'a',
      projectId: 'p',
      storageBucket: 's',
      messagingSenderId: '1',
      appId: 'x',
    }
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(config))
    render(<Root />)
    expect(mocks.initFirebase).toHaveBeenCalledWith(config, { local: false })
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
  })

  it('runs against the local kit in local mode, skipping setup', () => {
    vi.stubEnv('MODE', 'local')
    render(<Root />)
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
    expect(mocks.initFirebase).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'demo-data-platform-local' }),
      { local: true },
    )
  })
})
