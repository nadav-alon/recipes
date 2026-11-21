import { act, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'
import { recipes } from 'data-platform'
import { App } from './App.tsx'
import { fakeItemsPort } from './items/fake-items-port.ts'
import { fakeRecipeStore } from './recipes/fake-recipe-store.ts'
import { editRecipeHref, recipeHref } from './routes.ts'

const r1 = recipes.recipeId('r1')
const store = () =>
  fakeRecipeStore([{ id: r1, recipe: { title: 'Omelette', ingredients: [], prepSteps: [], steps: ['Whisk'] } }])

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

  it('says so when the Recipe at the URL does not exist', () => {
    location.hash = recipeHref(recipes.recipeId('nope'))
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This Recipe does not exist.')
  })
})
