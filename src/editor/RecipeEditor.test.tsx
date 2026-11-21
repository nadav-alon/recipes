import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import type { RecipeEntry } from '../recipes/recipe-store.ts'
import { RecipeEditor } from './RecipeEditor.tsx'

function stored(store: ReturnType<typeof fakeRecipeStore>): RecipeEntry[] {
  let entries: readonly RecipeEntry[] = []
  store.watch((e) => (entries = e))()
  return [...entries]
}

describe('RecipeEditor creating', () => {
  it('saves the title, Servings, source URL and notes as a new Recipe', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} onSaved={onSaved} />)
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
  const field = (name: string) => screen.getByLabelText(name)

  it('adds Ingredients with a quantity, a unit from the fixed set and a prep note', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} onSaved={onSaved} />)
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
    render(<RecipeEditor store={store} onSaved={onSaved} />)
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
    render(<RecipeEditor store={store} onSaved={onSaved} />)
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
  it('blocks saving a Recipe with no title and says why', () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Give the Recipe a title.')
    expect(onSaved).not.toHaveBeenCalled()
    expect(stored(store)).toEqual([])
  })

  it('blocks a unit without a quantity, then saves once it is fixed', async () => {
    const store = fakeRecipeStore()
    const onSaved = vi.fn()
    render(<RecipeEditor store={store} onSaved={onSaved} />)
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
})
