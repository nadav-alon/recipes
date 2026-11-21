import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { SetupScreen } from './SetupScreen.tsx'

const configJson = JSON.stringify({
  apiKey: 'k',
  authDomain: 'a.firebaseapp.com',
  projectId: 'p',
  storageBucket: 'p.appspot.com',
  messagingSenderId: '1',
  appId: '1:1:web:x',
})

function paste(text: string) {
  fireEvent.input(screen.getByLabelText('Firebase web config'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('SetupScreen', () => {
  it('hands a pasted config to onConfigured', () => {
    const onConfigured = vi.fn()
    render(<SetupScreen onConfigured={onConfigured} />)
    paste(configJson)
    expect(onConfigured).toHaveBeenCalledWith(JSON.parse(configJson))
  })

  it('shows why a pasted config was refused', () => {
    const onConfigured = vi.fn()
    render(<SetupScreen onConfigured={onConfigured} />)
    paste('{"apiKey":"k"}')
    expect(screen.getByRole('alert')).toHaveTextContent(/missing or has empty fields/)
    expect(onConfigured).not.toHaveBeenCalled()
  })

  it('shows an error carried in from a bad device-transfer link', () => {
    render(<SetupScreen onConfigured={vi.fn()} initialError="That device transfer link is truncated or corrupted." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/truncated or corrupted/)
  })
})
