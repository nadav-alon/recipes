import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

describe('App', () => {
  it('renders a placeholder screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
  })
})
