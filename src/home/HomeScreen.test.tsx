import { act, render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { core, recipes } from 'data-platform'
import { fakeItemsPort } from '../items/fake-items-port.ts'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import type { ItemsPort } from '../items/items-port.ts'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
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

  it('has a top app bar titled Recipes and no back arrow', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    expect(bar.queryByRole('button')).toBeNull()
  })

  it('shows Makeable, then Almost makeable with what is Missing, then every other Recipe', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Makeable',
      'Almost makeable',
      'Other Recipes',
    ])
    expect(section('Makeable').getByText('Bread')).toBeInTheDocument()
    expect(section('Almost makeable').getByRole('listitem')).toHaveTextContent('Missing: eggs')
    expect(section('Other Recipes').getByText('Zucchini')).toBeInTheDocument()
  })

  it('moves a Recipe between sections live when an Item changes State', async () => {
    const port = itemsPort()
    render(<HomeScreen recipeStore={store()} itemsPort={port} />)
    expect(section('Almost makeable').getByRole('link', { name: 'Omelette' })).toBeInTheDocument()
    await act(() => port.setItemState(core.itemId('eggs'), 'enough'))
    expect(section('Makeable').getByRole('link', { name: 'Omelette' })).toBeInTheDocument()
    expect(section('Almost makeable').queryByRole('link', { name: 'Omelette' })).toBeNull()
  })

  it('says so in each empty section and links to creating a Recipe', () => {
    render(<HomeScreen recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(section('Makeable').getByText(/nothing is makeable/i)).toBeInTheDocument()
    expect(section('Almost makeable').getByText(/no recipe is only/i)).toBeInTheDocument()
    expect(section('Other Recipes').getByText('No other Recipes.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New Recipe' })).toHaveAttribute('href', '#/recipes/new')
  })

  it('links each Recipe to its view', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.getByRole('link', { name: 'Bread' })).toHaveAttribute('href', '#/recipes/3')
    expect(screen.getByRole('link', { name: 'Omelette' })).toHaveAttribute('href', '#/recipes/2')
  })

  it('replaces the whole screen with a load error when the Recipe watch fails after it rendered', async () => {
    const recipeStore = store()
    render(<HomeScreen recipeStore={recipeStore} itemsPort={itemsPort()} />)
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    await act(() => recipeStore.failWatches(new Error('permission-denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('link', { name: 'New Recipe' })).toBeNull()
  })

  it('replaces the whole screen with the same load error when the Items watch fails after it rendered', async () => {
    const port = itemsPort()
    render(<HomeScreen recipeStore={store()} itemsPort={port} />)
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    await act(() => port.failWatches(new Error('permission-denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('link', { name: 'New Recipe' })).toBeNull()
  })

  it('shows the load error, not a blank page, when the Recipe watch fails before delivering anything', () => {
    const failingStore: RecipeStore = {
      ...store(),
      watch: (_onChange, onError) => {
        onError?.(new Error('permission-denied'))
        return () => {}
      },
    }
    render(<HomeScreen recipeStore={failingStore} itemsPort={itemsPort()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
  })

  it('shows the load error, not a blank page, when the Items watch fails before delivering anything', () => {
    const failingPort: ItemsPort = {
      ...itemsPort(),
      watchItems: (_onItems, onError) => {
        onError(new Error('permission-denied'))
        return () => {}
      },
    }
    render(<HomeScreen recipeStore={store()} itemsPort={failingPort} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
  })
})
