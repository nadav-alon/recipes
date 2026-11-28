import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch.tsx'

const css = readFileSync('src/shell/Switch.css', 'utf8')
const rule = (selector: string) => new RegExp(`${selector.replace(/[.+:()]/g, '\\$&')}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? ''

describe('Switch', () => {
  it('is a native checkbox with role switch, named by its label', () => {
    render(<Switch label="Want to make" checked={false} onChange={() => {}} />)
    const input = screen.getByRole('switch', { name: 'Want to make' })
    expect(input).toHaveAttribute('type', 'checkbox')
    expect(input).not.toBeChecked()
  })

  it('reflects checked and disabled', () => {
    render(<Switch label="Want to make" checked disabled onChange={() => {}} />)
    const input = screen.getByRole('switch', { name: 'Want to make' })
    expect(input).toBeChecked()
    expect(input).toBeDisabled()
  })

  it('toggles when the label text is tapped', () => {
    const onChange = vi.fn()
    render(<Switch label="Want to make" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByText('Want to make'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('Switch styles', () => {
  it('hides the native appearance', () => {
    expect(rule('.switch__input')).toMatch(/appearance:\s*none/)
  })

  it('uses theme roles only, with no literal colours', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
  })

  it('draws the off track and handle', () => {
    expect(rule('.switch__track')).toMatch(/border:[^;]*var\(--md-sys-color-outline\)/)
    expect(rule('.switch__track')).toMatch(/background:\s*var\(--md-sys-color-surface-container-highest\)/)
    expect(rule('.switch__track')).toMatch(/inline-size:\s*52px/)
    expect(rule('.switch__track')).toMatch(/block-size:\s*32px/)
    expect(rule('.switch__handle')).toMatch(/background:\s*var\(--md-sys-color-outline\)/)
    expect(rule('.switch__handle')).toMatch(/inline-size:\s*16px/)
  })

  it('draws the on track and handle', () => {
    expect(rule('.switch__input:checked + .switch__track')).toMatch(/background:\s*var\(--md-sys-color-primary\)/)
    expect(rule('.switch__input:checked + .switch__track .switch__handle')).toMatch(/background:\s*var\(--md-sys-color-on-primary\)/)
    expect(rule('.switch__input:checked + .switch__track .switch__handle')).toMatch(/inline-size:\s*24px/)
  })

  it('keeps the row at least 3rem tall', () => {
    expect(rule('.switch')).toMatch(/min-block-size:\s*3rem/)
  })

  it('shows a ring on keyboard focus and a 40px state layer', () => {
    expect(rule('.switch__input:focus-visible + .switch__track')).toMatch(/outline:\s*2px solid var\(--md-sys-color-primary\)/)
    expect(rule('.switch__handle::before')).toMatch(/inline-size:\s*40px/)
  })
})
