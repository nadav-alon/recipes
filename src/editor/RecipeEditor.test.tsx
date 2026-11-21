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
