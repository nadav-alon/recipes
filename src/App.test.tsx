import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recipes } from 'data-platform'
import { App } from './App.tsx'
import { fakeItemsPort } from './items/fake-items-port.ts'
import { fakeRecipeStore } from './recipes/fake-recipe-store.ts'
import { editRecipeHref, HOME_HREF, NEW_RECIPE_HREF, recipeHref } from './routes.ts'

const r1 = recipes.recipeId('r1')
const r2 = recipes.recipeId('r2')
const store = () =>
  fakeRecipeStore([
    { id: r1, recipe: { title: 'Omelette', ingredients: [], prepSteps: [], steps: ['Whisk'] } },
    { id: r2, recipe: { title: 'Pancakes', ingredients: [], prepSteps: [], steps: ['Flip'] } },
  ])

afterEach(() => {
  location.hash = ''
})

describe('App', () => {
  it('opens on the home screen', () => {
    render(<App recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'Makeable' })).toBeInTheDocument()
  })

  it('opens a Recipe directly from its URL, with an Edit link to its editor', () => {
    location.hash = recipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', editRecipeHref(r1))
  })

  it('follows the URL as it changes, from Home to a Recipe', async () => {
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    await act(() => {
      location.hash = recipeHref(r1)
      fireEvent(window, new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
  })

  it('edits the Recipe the URL names when it moves from one Recipe\'s editor to another\'s', async () => {
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByLabelText('Title')).toHaveValue('Omelette')
    await act(() => {
      location.hash = editRecipeHref(r2)
      fireEvent(window, new HashChangeEvent('hashchange'))
    })
    expect(screen.getByLabelText('Title')).toHaveValue('Pancakes')
  })

  it('says so when the Recipe at the URL does not exist', () => {
    location.hash = recipeHref(recipes.recipeId('nope'))
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This Recipe does not exist.')
  })

  it('opens the editor empty at the new-Recipe URL, and shows the Recipe once it is saved', async () => {
    location.hash = NEW_RECIPE_HREF
    render(<App recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument()
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(location.hash).toMatch(/^#\/recipes\/fake-/))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeInTheDocument()
  })

  it('opens the editor on the Recipe at its edit URL, and saving returns to its view', async () => {
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByLabelText('Title')).toHaveValue('Omelette')
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(location.hash).toBe(recipeHref(r1))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Frittata' })).toBeInTheDocument()
  })

  it('returns to Home once the Undo offer for a deleted Recipe ends', async () => {
    vi.useFakeTimers()
    try {
      location.hash = editRecipeHref(r1)
      render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
      })
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(location.hash).toBe(editRecipeHref(r1))
      await act(() => {
        vi.advanceTimersByTime(9000)
      })
      expect(location.hash).toBe(HOME_HREF)
    } finally {
      vi.useRealTimers()
    }
  })
})
