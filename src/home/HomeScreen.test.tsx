import { act, render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { core, recipes } from 'data-platform'
import { fakeItemsPort } from '../items/fake-items-port.ts'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import type { RecipeEntry } from '../recipes/recipe-store.ts'
import { HomeScreen } from './HomeScreen.tsx'

const item = (id: string, state: core.State, deleted = false) => ({
  id: core.itemId(id),
  name: id,
  state,
  deleted,
})

const entry = (id: string, title: string, ingredients: { name: string; item?: string }[]): RecipeEntry => ({
  id: recipes.recipeId(id),
  recipe: {
    title,
    ingredients: ingredients.map((i) => ({ name: i.name, ...(i.item ? { itemId: core.itemId(i.item) } : {}) })),
    steps: ['cook'],
  } as RecipeEntry['recipe'],
})

const section = (name: string) => within(screen.getByRole('region', { name }))

describe('HomeScreen', () => {
  const itemsPort = () => fakeItemsPort([item('flour', 'enough'), item('eggs', 'out'), item('milk', 'out')])
  const store = () =>
    fakeRecipeStore([
      entry('1', 'Zucchini', [{ name: 'zucchini' }, { name: 'eggs', item: 'eggs' }, { name: 'milk', item: 'milk' }]),
      entry('2', 'Omelette', [{ name: 'eggs', item: 'eggs' }, { name: 'flour', item: 'flour' }]),
      entry('3', 'Bread', [{ name: 'flour', item: 'flour' }]),
    ])

  it('shows Makeable, then Almost makeable with what is Missing, then every other Recipe', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Makeable',
      'Almost makeable',
      'Other Recipes',
    ])
    expect(section('Makeable').getByText('Bread')).toBeInTheDocument()
    expect(section('Almost makeable').getByText(/Omelette/)).toHaveTextContent('Missing: eggs')
    expect(section('Other Recipes').getByText('Zucchini')).toBeInTheDocument()
  })

  it('moves a Recipe between sections live when an Item changes State', async () => {
    const port = itemsPort()
    render(<HomeScreen recipeStore={store()} itemsPort={port} />)
    expect(section('Almost makeable').getByText(/Omelette/)).toBeInTheDocument()
    await act(() => port.setItemState(core.itemId('eggs'), 'enough'))
    expect(section('Makeable').getByText('Omelette')).toBeInTheDocument()
    expect(section('Almost makeable').queryByText(/Omelette/)).toBeNull()
  })
})
