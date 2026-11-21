import { describe, expect, it, vi } from 'vitest'
import { core, recipes } from 'data-platform'
import { fakeRecipeStore } from './fake-recipe-store.ts'
import { InvalidRecipeError, type Recipe } from './recipe-store.ts'

const pancakes: Recipe = {
  title: 'Pancakes',
  ingredients: [{ name: 'Flour', itemId: core.itemId('flour') }],
  prepSteps: [],
  steps: ['Fry'],
}

describe('fakeRecipeStore', () => {
  it('starts with the Recipes it is given and tells watchers about each change', async () => {
    const store = fakeRecipeStore([{ id: recipes.recipeId('pancakes'), recipe: pancakes }])
    const onChange = vi.fn()
    store.watch(onChange)
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'pancakes', recipe: pancakes }])

    const id = await store.create({ ...pancakes, title: 'Waffles' })
    expect(onChange.mock.lastCall?.[0].map((e: { id: string }) => e.id)).toEqual(['pancakes', id])

    await store.update(id, { ...pancakes, title: 'Thin waffles' })
    expect(onChange.mock.lastCall?.[0][1].recipe.title).toBe('Thin waffles')

    await store.softDelete(id)
    expect(onChange.mock.lastCall?.[0]).toHaveLength(1)

    await store.restore(id)
    expect(onChange.mock.lastCall?.[0]).toHaveLength(2)
  })

  it('refuses an invalid Recipe, as the real store does', async () => {
    const store = fakeRecipeStore()

    await expect(store.create({ ...pancakes, title: '' })).rejects.toBeInstanceOf(InvalidRecipeError)
  })

  it('stops calling a watcher once it unsubscribes', async () => {
    const store = fakeRecipeStore()
    const onChange = vi.fn()
    store.watch(onChange)()

    await store.create(pancakes)

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
