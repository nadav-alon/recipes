import { act, fireEvent, render, screen, within } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { core, recipes } from 'data-platform'
import { fakeItemsPort } from '../items/fake-items-port.ts'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import type { ItemsPort } from '../items/items-port.ts'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
import { MemberContext } from '../gate/account.tsx'
import { HomeScreen } from './HomeScreen.tsx'
import { expectAlertBanner } from '../test/alert-banner.ts'

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

const REM = 16
const PHONE = 360
const DESKTOP = 1280

/** Stubs matchMedia to evaluate `(min-width: Nrem)` against a viewport width; `resize` fires the change listeners. */
function viewport(width: number) {
  const listeners = new Set<() => void>()
  const list = (query: string) => ({
    get matches() {
      const min = /\(min-width:\s*([\d.]+)rem\)/.exec(query)
      return min !== null && width >= Number(min[1]) * REM
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })
  vi.stubGlobal('matchMedia', list)
  return {
    resize(next: number) {
      width = next
      listeners.forEach((l) => l())
    },
  }
}

describe('New Recipe action by viewport', () => {
  afterEach(() => vi.unstubAllGlobals())
  const home = () => render(<HomeScreen recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)

  it('is the one icon-only "+" button in the page on a phone, with nothing in the bar', () => {
    viewport(PHONE)
    home()
    expect(within(screen.getByRole('banner')).queryByRole('button')).toBeNull()
    const buttons = screen.getAllByRole('button', { name: 'New Recipe' })
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).not.toHaveTextContent('New Recipe')
  })

  it('is the one labelled "New Recipe" button, in the top app bar, at 1280px wide', () => {
    viewport(DESKTOP)
    home()
    expect(screen.getAllByRole('button', { name: 'New Recipe' })).toHaveLength(1)
    const button = within(screen.getByRole('banner')).getByRole('button', { name: 'New Recipe' })
    expect(button).toHaveTextContent('New Recipe')
    fireEvent.click(button)
    expect(location.hash).toBe('#/recipes/new')
  })

  it('moves to the bar as soon as the viewport reaches the 720px column width, not before', () => {
    const screenSize = viewport(719)
    home()
    expect(within(screen.getByRole('banner')).queryByRole('button')).toBeNull()
    act(() => screenSize.resize(720))
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'New Recipe' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New Recipe' })).toHaveLength(1)
    act(() => screenSize.resize(PHONE))
    expect(within(screen.getByRole('banner')).queryByRole('button')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'New Recipe' })).toHaveLength(1)
  })
})

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
    expect(bar.queryByRole('button', { name: /back/i })).toBeNull()
  })

  it('opens the signed-in account from the top app bar, showing its email and signing out', () => {
    const signOut = vi.fn()
    render(
      <MemberContext.Provider value={{ email: 'a@example.com', signOut }}>
        <HomeScreen recipeStore={store()} itemsPort={itemsPort()} />
      </MemberContext.Provider>,
    )
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Account' }))
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('marks the row of a Wanted Recipe as wanted, and no other', () => {
    const wanted = entry('3', 'Bread', [{ name: 'flour', item: 'flour' }])
    const others = [entry('1', 'Zucchini', [{ name: 'zucchini' }]), entry('2', 'Omelette', [{ name: 'flour', item: 'flour' }])]
    render(
      <HomeScreen
        recipeStore={fakeRecipeStore([...others, { ...wanted, recipe: { ...wanted.recipe, wanted: true } }])}
        itemsPort={itemsPort()}
      />,
    )
    const row = (title: string) => screen.getByRole('link', { name: new RegExp(title) })
    expect(within(row('Bread')).getByText('Want to make')).toBeInTheDocument()
    expect(within(row('Omelette')).queryByText('Want to make')).toBeNull()
    expect(within(row('Zucchini')).queryByText('Want to make')).toBeNull()
  })

  it('shows Makeable, then Almost makeable with what is Missing, then every other Recipe', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Makeable',
      'Almost makeable',
      'Other Recipes',
    ])
    expect(section('Makeable').getByText('Bread')).toBeInTheDocument()
    expect(section('Almost makeable').getByRole('listitem')).toHaveTextContent('Missing 1: eggs')
    expect(section('Other Recipes').getByText('Zucchini')).toBeInTheDocument()
  })

  it('says how many and which Ingredients an Other Recipe is Missing', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(section('Other Recipes').getByRole('listitem')).toHaveTextContent('Missing 3: zucchini, eggs, milk')
  })

  it('counts and names every missing Ingredient on an Almost makeable row', () => {
    render(
      <HomeScreen
        recipeStore={fakeRecipeStore([
          entry('4', 'Pancakes', [{ name: 'flour', item: 'flour' }, { name: 'eggs', item: 'eggs' }, { name: 'milk', item: 'milk' }]),
        ])}
        itemsPort={itemsPort()}
      />,
    )
    expect(section('Almost makeable').getByRole('listitem')).toHaveTextContent('Missing 2: eggs, milk')
  })

  it('keeps the "(Item deleted)" suffix inside the counted Missing form', () => {
    render(
      <HomeScreen
        recipeStore={fakeRecipeStore([entry('5', 'Toast', [{ name: 'butter', item: 'butter' }])])}
        itemsPort={fakeItemsPort([item('butter', 'enough', true)])}
      />,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('Missing 1: butter (Item deleted)')
  })

  it('moves a Recipe between sections live when an Item changes State', async () => {
    const port = itemsPort()
    render(<HomeScreen recipeStore={store()} itemsPort={port} />)
    expect(section('Almost makeable').getByRole('link', { name: /Omelette/ })).toBeInTheDocument()
    await act(() => port.setItemState(core.itemId('eggs'), 'enough'))
    expect(section('Makeable').getByRole('link', { name: 'Omelette' })).toBeInTheDocument()
    expect(section('Almost makeable').queryByRole('link', { name: /Omelette/ })).toBeNull()
  })

  it('says so in each empty section and links to creating a Recipe', () => {
    render(<HomeScreen recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(section('Makeable').getByText(/nothing is makeable/i)).toBeInTheDocument()
    expect(section('Almost makeable').getByText(/no recipe is only/i)).toBeInTheDocument()
    expect(section('Other Recipes').getByText('No other Recipes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Recipe' })).toBeInTheDocument()
  })

  it('opens the new Recipe editor from the New Recipe button', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    fireEvent.click(screen.getByRole('button', { name: 'New Recipe' }))
    expect(location.hash).toBe('#/recipes/new')
  })

  it('follows a Recipe row to its view without leaving the page', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    fireEvent.click(screen.getByRole('link', { name: 'Bread' }))
    expect(location.hash).toBe('#/recipes/3')
  })

  it('ends every Recipe row in a decorative chevron, in each section', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      const chevron = within(row).getByTestId('recipe-row-chevron')
      expect(chevron).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('links each Recipe to its view', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.getByRole('link', { name: 'Bread' })).toHaveAttribute('href', '#/recipes/3')
    expect(screen.getByRole('link', { name: 'OmeletteMissing 1: eggs' })).toHaveAttribute('href', '#/recipes/2')
  })

  it('replaces the whole screen with a load error when the Recipe watch fails after it rendered', async () => {
    const recipeStore = store()
    render(<HomeScreen recipeStore={recipeStore} itemsPort={itemsPort()} />)
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    await act(() => recipeStore.failWatches(new Error('permission-denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
    expectAlertBanner(screen.getByRole('alert'))
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alert'))
    expect(screen.getByRole('main')).toHaveClass('screen')
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Recipe' })).toBeNull()
  })

  it('replaces the whole screen with the same load error when the Items watch fails after it rendered', async () => {
    const port = itemsPort()
    render(<HomeScreen recipeStore={store()} itemsPort={port} />)
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    await act(() => port.failWatches(new Error('permission-denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alert'))
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Recipe' })).toBeNull()
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
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
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
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
  })
})

describe('HomeScreen loading and Retry', () => {
  const store = () => fakeRecipeStore([entry('3', 'Bread', [{ name: 'flour', item: 'flour' }])])
  const itemsPort = () => fakeItemsPort([item('flour', 'enough')])

  it('shows the app bar and a progressbar until both the Recipes and the Items have arrived', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={fakeItemsPort([], { neverDelivers: true })} />)
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Makeable' })).toBeNull()
  })

  it('has no progressbar once both have arrived', () => {
    render(<HomeScreen recipeStore={store()} itemsPort={itemsPort()} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Makeable' })).toBeInTheDocument()
  })

  it('Retry starts new watches, shows loading, then the loaded screen when they deliver', async () => {
    const recipeStore = store()
    const port = itemsPort()
    render(<HomeScreen recipeStore={recipeStore} itemsPort={port} />)
    await act(() => recipeStore.failWatches(new Error('permission-denied')))
    const recipeWatch = vi.spyOn(recipeStore, 'watch')
    const itemsWatch = vi.spyOn(port, 'watchItems')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }))
    expect(recipeWatch).toHaveBeenCalledTimes(1)
    expect(itemsWatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Makeable' })).toBeInTheDocument()
  })

  it('shows the loading state after Retry until the new watches deliver', async () => {
    const recipeStore = store()
    const port = fakeItemsPort([item('flour', 'enough')])
    const { rerender } = render(<HomeScreen recipeStore={recipeStore} itemsPort={port} />)
    await act(() => recipeStore.failWatches(new Error('permission-denied')))
    vi.spyOn(port, 'watchItems').mockImplementation(() => () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    rerender(<HomeScreen recipeStore={recipeStore} itemsPort={port} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
  })

  it('shows the failure banner again when Retry fails again', async () => {
    const recipeStore = store()
    render(<HomeScreen recipeStore={recipeStore} itemsPort={itemsPort()} />)
    await act(() => recipeStore.failWatches(new Error('permission-denied')))
    vi.spyOn(recipeStore, 'watch').mockImplementation((_change, onError) => (onError?.(new Error('again')), () => {}))
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipes could not be loaded.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
