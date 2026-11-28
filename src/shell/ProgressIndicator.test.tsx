import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { ProgressIndicator } from './ProgressIndicator.tsx'

const css = readFileSync('src/shell/ProgressIndicator.css', 'utf8')

describe('ProgressIndicator', () => {
  it('is a progressbar with the accessible name it is given', () => {
    render(<ProgressIndicator label="Checking your Household" />)
    expect(screen.getByRole('progressbar', { name: 'Checking your Household' })).toBeInTheDocument()
  })

  it('is indeterminate: it carries no value', () => {
    render(<ProgressIndicator label="Working" />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })
})

describe('ProgressIndicator styles', () => {
  it('colours the arc from the primary role only', () => {
    expect(css).toMatch(/var\(--md-sys-color-primary\)/)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
  })

  it('stops animating under prefers-reduced-motion: reduce', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}\s*\}/.exec(css)?.[0] ?? ''
    expect(block).toMatch(/animation:\s*none/)
  })
})
