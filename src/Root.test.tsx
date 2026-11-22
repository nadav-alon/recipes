import { fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initFirebase: vi.fn(),
}))

vi.mock('data-platform/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('data-platform/client')>()),
  initFirebase: mocks.initFirebase,
  authClient: () => ({ onAuthChange: () => () => {}, signIn: vi.fn(), signOut: vi.fn() }),
}))

import { localKit } from 'data-platform/local'
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
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Set up' }))
    expect(screen.queryByRole('banner')).toBeNull()
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
    expect(mocks.initFirebase).toHaveBeenCalledWith(config, { local: undefined })
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
  })

  it('runs against the local kit in emulator mode, skipping setup', () => {
    vi.stubEnv('MODE', 'emulator')
    render(<Root />)
    expect(screen.queryByRole('heading', { name: 'Set up' })).toBeNull()
    expect(mocks.initFirebase).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'demo-data-platform-local' }),
      { local: localKit },
    )
  })
})

describe('Root and deep links', () => {
  const stored = { apiKey: 'k', authDomain: 'a', projectId: 'p', storageBucket: 's', messagingSenderId: '1', appId: 'x' }

  it('keeps a screen URL through setup, so it is still there once the gate passes', () => {
    history.replaceState(null, '', '/#/recipes/r1/edit')
    render(<Root />)
    expect(screen.getByRole('heading', { name: 'Set up' })).toBeInTheDocument()
    expect(location.hash).toBe('#/recipes/r1/edit')
  })

  it('keeps a screen URL at the sign-in gate', () => {
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', '/#/recipes/r1')
    render(<Root />)
    expect(mocks.initFirebase).toHaveBeenCalled()
    expect(location.hash).toBe('#/recipes/r1')
  })
})

describe('Root and #config= links', () => {
  const stored = {
    apiKey: 'k',
    authDomain: 'a',
    projectId: 'p',
    storageBucket: 's',
    messagingSenderId: '1',
    appId: 'x',
  }
  const hashFor = (value: unknown) => `#config=${btoa(JSON.stringify(value)).replace(/=+$/, '')}`

  it('shows a refused link on the connected path, and can dismiss it', () => {
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', '/#config=!!!')
    render(<Root />)
    expect(screen.getByRole('alert')).toHaveTextContent(/truncated or corrupted/)
    expect(location.hash).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('asks before replacing a different stored config', () => {
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', `/${hashFor({ ...stored, projectId: 'other' })}`)
    render(<Root />)
    expect(screen.getByRole('heading', { name: 'Switch Household?' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('data-platform:firebase-config')!).projectId).toBe('p')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to other' }))
    expect(JSON.parse(localStorage.getItem('data-platform:firebase-config')!).projectId).toBe('other')
    expect(mocks.initFirebase).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'other' }),
      { local: undefined },
    )
  })

  it('keeps the stored config when the switch is declined', () => {
    localStorage.setItem('data-platform:firebase-config', JSON.stringify(stored))
    history.replaceState(null, '', `/${hashFor({ ...stored, projectId: 'other' })}`)
    render(<Root />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep the current Household' }))
    expect(mocks.initFirebase).toHaveBeenCalledWith(stored, { local: undefined })
  })
})
