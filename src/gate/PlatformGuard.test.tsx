import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase/firestore'

const mocks = vi.hoisted(() => ({ data: undefined as unknown, fail: false }))

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => path,
  getDoc: async () => {
    if (mocks.fail) throw new Error('permission-denied')
    return { data: () => mocks.data }
  },
}))

import { core } from 'data-platform'
import { HOUSEHOLD_SETUP_DOC_URL, PlatformGuard } from './PlatformGuard.tsx'

const db = {} as Firestore

beforeEach(() => {
  mocks.data = undefined
  mocks.fail = false
})

describe('PlatformGuard', () => {
  it('shows nothing when the deployed platform is new enough', async () => {
    mocks.data = { version: core.PLATFORM_VERSION }
    render(<PlatformGuard db={db} />)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('shows a banner when the deployed platform is older than the pin', async () => {
    mocks.data = { version: '0.1.0' }
    render(<PlatformGuard db={db} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/update your platform deploy/i)
  })

  it('offers the household setup guide as a button on the banner', async () => {
    mocks.data = { version: '0.1.0' }
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<PlatformGuard db={db} />)
    expect(await screen.findByRole('alert')).toHaveClass('ui-alert-banner')
    fireEvent.click(screen.getByRole('button', { name: 'Open the household setup guide' }))
    expect(open).toHaveBeenCalledWith(HOUSEHOLD_SETUP_DOC_URL, '_blank', 'noopener')
    expect(screen.queryByRole('link')).toBeNull()
    open.mockRestore()
  })

  it('shows the banner when nothing has deployed meta/platform', async () => {
    render(<PlatformGuard db={db} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/update your platform deploy/i)
  })
})

describe('PlatformGuard when the read fails', () => {
  it('says the version could not be checked instead of passing silently', async () => {
    mocks.fail = true
    render(<PlatformGuard db={db} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't check your platform version/i)
  })
})
