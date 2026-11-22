import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetSnackbar, SnackbarHost } from 'household-ui/ui/Snackbar.tsx'
import { core, recipes } from 'data-platform'
import { fakeItemsPort } from '../items/fake-items-port.ts'
import type { WatchedItem } from '../items/items-port.ts'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import type { RecipeEntry } from '../recipes/recipe-store.ts'
import { RecipeEditor } from './RecipeEditor.tsx'

const item = (id: string, name: string, state: WatchedItem['state'], deleted = false): WatchedItem => ({
  id: core.itemId(id),
  name,
  state,
  deleted,
})

const CATALOGUE = [item('milk', 'Milk', 'running low'), item('oat-milk', 'Oat milk', 'enough'), item('flour', 'Flour', 'out'), item('beef', 'Beef', 'enough')]

function itemsPort(items: readonly WatchedItem[] = CATALOGUE) {
  return fakeItemsPort(items)
}

const field = (name: string) => screen.getByLabelText(name)
const openPicker = (row: string) => fireEvent.click(screen.getByRole('button', { name: `Choose Item for ${row}` }))
const pickerRow = (name: string) => screen.getByRole('button', { name })

function stored(store: ReturnType<typeof fakeRecipeStore>): RecipeEntry[] {
  let entries: readonly RecipeEntry[] = []
  store.watch((e) => (entries = e))()
  return [...entries]
}

describe('RecipeEditor top app bar', () => {
  it('titles the bar New Recipe when creating, with a back arrow', () => {
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={itemsPort()} />)
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument()
    expect(bar.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('titles the bar Edit Recipe when editing, with a back arrow', () => {
    const store = fakeRecipeStore([
      { id: recipes.recipeId('r1'), recipe: { title: 'Pancakes', ingredients: [], prepSteps: [], steps: [] } },
    ])
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={stored(store)[0]} />)
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument()
    expect(bar.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})

describe('RecipeEditor creating', () => {
  it('reports the new Recipe\'s id once the store has created it', async () => {
    const store = fakeRecipeStore()
    const onCreated = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onCreated={onCreated} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(stored(store)[0].id))
  })

  it('saves the title, Servings, source URL and notes as a new Recipe', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '4' } })
    fireEvent.input(screen.getByLabelText('Source URL'), { target: { value: 'https://example.com/p' } })
    fireEvent.input(screen.getByLabelText('Notes'), { target: { value: 'Rest the batter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store).map((e) => e.recipe)).toEqual([
      {
        title: 'Pancakes',
        ingredients: [],
        prepSteps: [],
        steps: [],
        servings: 4,
        sourceUrl: 'https://example.com/p',
        notes: 'Rest the batter',
      },
    ])
  })
})

describe('RecipeEditor Ingredients', () => {
  it('adds Ingredients with a quantity, a unit from the fixed set and a prep note', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.input(field('Title'), { target: { value: 'Stew' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Ingredient' }))
    fireEvent.input(field('Ingredient 1 name'), { target: { value: 'Onion' } })
    fireEvent.input(field('Ingredient 1 quantity'), { target: { value: '2' } })
    fireEvent.change(field('Ingredient 1 unit'), { target: { value: 'piece' } })
    fireEvent.input(field('Ingredient 1 prep note'), { target: { value: 'sliced' } })
    expect([...(field('Ingredient 1 unit') as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      '', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)[0].recipe.ingredients).toEqual([{ name: 'Onion', quantity: 2, unit: 'piece', prepNote: 'sliced' }])
  })

  it('removes and reorders Ingredients', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.input(field('Title'), { target: { value: 'Stew' } })
    for (const [i, name] of ['Onion', 'Beef', 'Salt'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: 'Add Ingredient' }))
      fireEvent.input(field(`Ingredient ${i + 1} name`), { target: { value: name } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Move Ingredient 3 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Ingredient 1 down' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ingredient 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)[0].recipe.ingredients.map((i) => i.name)).toEqual(['Salt', 'Onion'])
  })
})

describe.each([
  ['Prep Step', 'prepSteps'],
  ['Step', 'steps'],
] as const)('RecipeEditor %ss', (label, key) => {
  it('adds, edits, removes and reorders them', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Stew' } })
    for (const [i, text] of ['Chop', 'Brown', 'Simmer', 'Oops'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: `Add ${label}` }))
      fireEvent.input(screen.getByLabelText(`${label} ${i + 1} text`), { target: { value: text } })
    }
    fireEvent.input(screen.getByLabelText(`${label} 2 text`), { target: { value: 'Brown well' } })
    fireEvent.click(screen.getByRole('button', { name: `Move ${label} 3 up` }))
    fireEvent.click(screen.getByRole('button', { name: `Move ${label} 1 down` }))
    fireEvent.click(screen.getByRole('button', { name: `Remove ${label} 4` }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)[0].recipe[key]).toEqual(['Simmer', 'Chop', 'Brown well'])
  })
})

describe('RecipeEditor validation', () => {
  it('shows each problem as a household-ui field error', () => {
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={itemsPort()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveClass('ui-field__error')
  })

  it('blocks saving a Recipe with no title and says why', () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Give the Recipe a title.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(stored(store)).toEqual([])
  })

  it('blocks a unit without a quantity, then saves once it is fixed', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} onSaved={onSaved} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Soup' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Ingredient' }))
    fireEvent.input(screen.getByLabelText('Ingredient 1 name'), { target: { value: 'Salt' } })
    fireEvent.change(screen.getByLabelText('Ingredient 1 unit'), { target: { value: 'g' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ingredient 1: a unit needs a quantity.')
    expect(onSaved).not.toHaveBeenCalled()

    fireEvent.input(screen.getByLabelText('Ingredient 1 quantity'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('blocks a Recipe the schema refuses, says why and does not report it saved', () => {
    const odd = {
      id: recipes.recipeId('odd'),
      recipe: { title: 'Odd', ingredients: [{ name: 'Salt', assumed: false }], prepSteps: [], steps: [] },
    } as unknown as RecipeEntry
    const store = fakeRecipeStore([odd])
    const update = vi.spyOn(store, 'update')
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={odd} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('ingredients.0.assumed')
    expect(onSaved).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('RecipeEditor editing', () => {
  const beef = { name: 'Beef', itemId: core.itemId('beef'), quantity: 500, unit: 'g' as const }
  const water = { name: 'Water', assumed: true as const }
  const entry: RecipeEntry = {
    id: recipes.recipeId('stew'),
    recipe: { title: 'Stew', ingredients: [beef, water], prepSteps: ['Cube'], steps: ['Simmer'], servings: 4, notes: 'Nice' },
  }

  it('shows the Recipe and updates it under the same id, keeping links and Assumed marks', async () => {
    const store = fakeRecipeStore([entry])
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onSaved={onSaved} />)
    expect(screen.getByLabelText('Title')).toHaveValue('Stew')
    expect(screen.getByLabelText('Ingredient 1 unit')).toHaveValue('g')

    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Beef stew' } })
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '' } })
    fireEvent.input(screen.getByLabelText('Ingredient 1 quantity'), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)).toEqual([
      {
        id: 'stew',
        recipe: {
          title: 'Beef stew',
          ingredients: [{ ...beef, quantity: 600 }, water],
          prepSteps: ['Cube'],
          steps: ['Simmer'],
          notes: 'Nice',
        },
      },
    ])
  })
})

describe('RecipeEditor deleting', () => {
  afterEach(resetSnackbar)

  const entry: RecipeEntry = {
    id: recipes.recipeId('stew'),
    recipe: { title: 'Stew', ingredients: [], prepSteps: [], steps: [] },
  }

  it('offers no delete while creating', () => {
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={itemsPort()} />)
    expect(screen.queryByRole('button', { name: 'Delete Recipe' })).not.toBeInTheDocument()
  })

  it('Soft deletes the Recipe and offers Undo in a snackbar, which brings it back', async () => {
    const store = fakeRecipeStore([entry])
    const onDeleted = vi.fn()
    render(
      <>
        <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onDeleted={onDeleted} />
        <SnackbarHost />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))

    expect(screen.getByRole('status')).toHaveTextContent('Deleted Stew')
    await waitFor(() => expect(stored(store)).toEqual([]))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(stored(store).map((e) => e.id)).toEqual(['stew']))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps Delete and Save off while the Recipe is Soft deleted, and on again after Undo', async () => {
    const store = fakeRecipeStore([entry])
    render(
      <>
        <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} />
        <SnackbarHost />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
    expect(screen.getByRole('button', { name: 'Delete Recipe' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Delete Recipe' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('tells the parent only once the Undo offer ends unused, so closing the editor then loses nothing', async () => {
    vi.useFakeTimers()
    try {
      const store = fakeRecipeStore([entry])
      const onDeleted = vi.fn()
      render(
        <>
          <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onDeleted={onDeleted} />
          <SnackbarHost />
        </>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
      expect(onDeleted).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(6000)
      expect(onDeleted).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Delete Recipe' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not tell the parent about a deletion that Undo took back', async () => {
    const store = fakeRecipeStore([entry])
    const onDeleted = vi.fn()
    render(
      <>
        <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onDeleted={onDeleted} />
        <SnackbarHost />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(stored(store).map((e) => e.id)).toEqual(['stew']))
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('does not tell the parent once the editor is gone before the Undo offer ends', async () => {
    vi.useFakeTimers()
    try {
      const store = fakeRecipeStore([entry])
      const onDeleted = vi.fn()
      const { unmount } = render(
        <>
          <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onDeleted={onDeleted} />
          <SnackbarHost />
        </>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
      unmount()
      await vi.advanceTimersByTimeAsync(6000)
      expect(onDeleted).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes the snackbar away after a while, leaving the Recipe deleted', async () => {
    vi.useFakeTimers()
    try {
      const store = fakeRecipeStore([entry])
      render(
        <>
          <RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} />
          <SnackbarHost />
        </>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
      await vi.advanceTimersByTimeAsync(6000)
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
      expect(stored(store)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('RecipeEditor linking an Ingredient to an Item', () => {
  it('searches live Items by name, shows each State, and saves the link', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(
      <RecipeEditor
        store={store}
        itemsPort={itemsPort([...CATALOGUE, item('gone', 'Milk powder', 'enough', true)])}
        onSaved={onSaved}
      />,
    )
    fireEvent.input(field('Title'), { target: { value: 'Porridge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Ingredient' }))
    fireEvent.input(field('Ingredient 1 name'), { target: { value: 'Milk' } })

    openPicker('Ingredient 1')
    expect(screen.getByRole('dialog', { name: 'Ingredient 1 Item' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^(Milk|Oat milk) / })).toHaveLength(0)
    fireEvent.input(field('Ingredient 1 Item search'), { target: { value: 'MILK' } })
    expect(screen.getAllByRole('button', { name: /^(Milk|Oat milk) / }).map((b) => b.textContent)).toEqual([
      'Milkrunning low',
      'Oat milkenough',
    ])

    fireEvent.click(pickerRow('Oat milk enough'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Linked to Oat milk (enough)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)[0].recipe.ingredients).toEqual([{ name: 'Milk', itemId: 'oat-milk' }])
  })
})

const entryOf = (id: string): RecipeEntry => ({
  id: recipes.recipeId('x'),
  recipe: { title: 'X', ingredients: [{ name: 'Beef', itemId: core.itemId(id) }], prepSteps: [], steps: [] },
})

describe('RecipeEditor adding to the Catalogue', () => {
  const edited = (ingredients: RecipeEntry['recipe']['ingredients']): RecipeEntry => ({
    id: recipes.recipeId('r 1'),
    recipe: { title: 'X', ingredients, prepSteps: [], steps: [] },
  })

  it('offers an Unlinked Ingredient the Catalogue hand-off, naming it and returning to this Recipe and Ingredient', () => {
    const entry = edited([{ name: 'Beef', itemId: core.itemId('beef') }, { name: 'Sea salt' }])
    render(<RecipeEditor store={fakeRecipeStore([entry])} itemsPort={itemsPort()} entry={entry} />)

    expect(screen.queryByRole('link', { name: 'Add Ingredient 1 to Catalogue' })).toBeNull()
    const href = screen.getByRole('link', { name: 'Add Ingredient 2 to Catalogue' }).getAttribute('href')!
    const handOff = new URL(href, location.origin)
    expect(handOff.pathname).toBe('/home-catalogue/')
    const params = new URLSearchParams(handOff.hash.replace('#/items?', ''))
    expect(params.get('add')).toBe('Sea salt')
    expect(params.get('return')).toBe(`${location.origin}${location.pathname}#/recipes/r%201/ingredients/1/Sea%20salt`)
  })

  it('stops offering it once the draft has unsaved edits, which following it would lose', () => {
    const entry = edited([{ name: 'Sea salt' }])
    render(<RecipeEditor store={fakeRecipeStore([entry])} itemsPort={itemsPort()} entry={entry} />)
    expect(screen.getByRole('link', { name: 'Add Ingredient 1 to Catalogue' })).toBeTruthy()

    fireEvent.input(field('Title'), { target: { value: 'Y' } })
    expect(screen.queryByRole('link', { name: /to Catalogue$/ })).toBeNull()
  })

  it('does not offer it for an Assumed Ingredient', () => {
    const entry = edited([{ name: 'Water', assumed: true }])
    render(<RecipeEditor store={fakeRecipeStore([entry])} itemsPort={itemsPort()} entry={entry} />)
    expect(screen.queryByRole('link', { name: /to Catalogue$/ })).toBeNull()
  })
})

describe('RecipeEditor unlinking and marking Assumed', () => {
  it('does not offer an Ingredient the Item it is already linked to', () => {
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={itemsPort()} entry={entryOf('beef')} />)
    fireEvent.input(field('Ingredient 1 Item search'), { target: { value: 'b' } })
    expect(screen.queryByRole('button', { name: /^Link Ingredient 1 to Beef/ })).toBeNull()
  })

  const beef = { name: 'Beef', itemId: core.itemId('beef'), quantity: 500, unit: 'g' as const }
  const entry: RecipeEntry = {
    id: recipes.recipeId('stew'),
    recipe: { title: 'Stew', ingredients: [beef, { name: 'Water', assumed: true as const }], prepSteps: [], steps: [] },
  }
  const save = async (store: ReturnType<typeof fakeRecipeStore>, onSaved: () => void) => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    return stored(store)[0].recipe.ingredients
  }

  it('unlinks an Ingredient, keeping the rest of the line', async () => {
    const store = fakeRecipeStore([entry])
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Ingredient 1' }))
    expect(screen.queryByText(/^Linked to/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unlink Ingredient 1' })).toBeNull()

    expect((await save(store, onSaved))[0]).toEqual({ name: 'Beef', quantity: 500, unit: 'g' })
  })

  it('marking an Ingredient Assumed clears its link, and the mark can be removed', async () => {
    const store = fakeRecipeStore([entry])
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onSaved={onSaved} />)
    fireEvent.click(screen.getByLabelText('Ingredient 1 assumed'))
    fireEvent.click(screen.getByLabelText('Ingredient 2 assumed'))

    expect(await save(store, onSaved)).toEqual([
      { name: 'Beef', assumed: true, quantity: 500, unit: 'g' },
      { name: 'Water' },
    ])
  })

  it('linking an Assumed Ingredient to an Item removes the mark', async () => {
    const store = fakeRecipeStore([entry])
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort()} entry={entry} onSaved={onSaved} />)
    openPicker('Ingredient 2')
    fireEvent.input(field('Ingredient 2 Item search'), { target: { value: 'flour' } })
    fireEvent.click(pickerRow('Flour out'))
    expect((screen.getByLabelText('Ingredient 2 assumed') as HTMLInputElement).checked).toBe(false)

    expect((await save(store, onSaved))[1]).toEqual({ name: 'Water', itemId: 'flour' })
  })
})

describe('RecipeEditor Ingredients linked to a soft-deleted Item', () => {
  const entryLinkedTo = (id: string): RecipeEntry => ({
    id: recipes.recipeId('porridge'),
    recipe: { title: 'Porridge', ingredients: [{ name: 'Milk', itemId: core.itemId(id) }], prepSteps: [], steps: [] },
  })
  const says = /Ingredient 1 is linked to .*an Item the Catalogue has soft-deleted/

  it.each([
    ['soft-deleted', [...CATALOGUE, item('old', 'Old milk', 'enough', true)]],
    ['no longer listed', CATALOGUE],
  ])('says so for an Item that is %s, and relinking replaces the link', async (_, items) => {
    const store = fakeRecipeStore([entryLinkedTo('old')])
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} itemsPort={itemsPort(items)} entry={entryLinkedTo('old')} onSaved={onSaved} />)
    expect(screen.getByText(says)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Old milk/ })).toBeNull()

    openPicker('Ingredient 1')
    fireEvent.input(field('Ingredient 1 Item search'), { target: { value: 'milk' } })
    fireEvent.click(pickerRow('Milk running low'))
    expect(screen.queryByText(says)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(stored(store)[0].recipe.ingredients).toEqual([{ name: 'Milk', itemId: 'milk' }])
  })

  it('does not say so for a live Item', () => {
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={itemsPort()} entry={entryLinkedTo('milk')} />)
    expect(screen.queryByText(says)).toBeNull()
    expect(screen.getByText('Linked to Milk (running low)')).toBeTruthy()
  })

  it('says the link has not been checked before the Items have arrived', () => {
    render(
      <RecipeEditor
        store={fakeRecipeStore()}
        itemsPort={fakeItemsPort(CATALOGUE, { neverDelivers: true })}
        entry={entryLinkedTo('old')}
      />,
    )
    expect(screen.queryByText(says)).toBeNull()
    expect(screen.getByText(/Ingredient 1 is linked to an Item, but the Items have not loaded/)).toBeTruthy()
  })

  it('says the link has not been checked when the watch fails before delivering', () => {
    const port = fakeItemsPort(CATALOGUE, { neverDelivers: true })
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={port} entry={entryLinkedTo('old')} />)
    act(() => port.failWatches(new Error('permission-denied')))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Ingredient 1 is linked to an Item, but the Items have not loaded/)).toBeTruthy()
  })

  it('names the soft-deleted Item when the Catalogue still lists it', () => {
    render(
      <RecipeEditor
        store={fakeRecipeStore()}
        itemsPort={itemsPort([...CATALOGUE, item('old', 'Old milk', 'enough', true)])}
        entry={entryLinkedTo('old')}
      />,
    )
    expect(screen.getByText(/Ingredient 1 is linked to Old milk, an Item the Catalogue has soft-deleted/)).toBeTruthy()
  })
})
