// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { core } from 'data-platform'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreRecipeStore, InvalidRecipeError, type Recipe, type RecipeEntry, type RecipeStore } from './recipe-store.ts'

const pancakes: Recipe = {
  title: 'Pancakes',
  ingredients: [{ name: 'Flour', itemId: core.itemId('flour') }],
  prepSteps: [],
  steps: ['Fry'],
}

describe('firestoreRecipeStore', () => {
  let emulator: Emulator
  let store: RecipeStore

  beforeAll(async () => {
    emulator = await startEmulator()
  })
  afterAll(() => emulator.close())
  beforeEach(async () => {
    await emulator.reset(['alice'])
    store = firestoreRecipeStore(emulator.client('alice'))
  })

  const current = (): Promise<readonly RecipeEntry[]> =>
    new Promise((resolve) => {
      const stop = store.watch((entries) => {
        stop()
        resolve(entries)
      })
    })

  describe('watch', () => {
    it('lists the live Recipes with their ids and leaves out soft-deleted ones', async () => {
      await emulator.seed('recipes/pancakes', pancakes)
      await emulator.seed('recipes/old', { ...pancakes, title: 'Old', deletedAt: { seconds: 1, nanoseconds: 0 } })

      const entries = await current()

      expect(entries.map((e) => [e.id, e.recipe.title])).toEqual([['pancakes', 'Pancakes']])
    })

    it('reports an empty list when there are no Recipes', async () => {
      expect(await current()).toEqual([])
    })

    it('calls again when a Recipe appears, until stopped', async () => {
      const onChange = vi.fn()
      const stop = store.watch(onChange)
      await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]))

      await emulator.seed('recipes/pancakes', pancakes)
      await vi.waitFor(() => expect(onChange.mock.lastCall?.[0]).toHaveLength(1))

      stop()
      const calls = onChange.mock.calls.length
      await emulator.seed('recipes/waffles', pancakes)
      await new Promise((r) => setTimeout(r, 200))
      expect(onChange.mock.calls).toHaveLength(calls)
    })
  })

  describe('create', () => {
    it('saves a valid Recipe and resolves with the id it is watched under', async () => {
      const id = await store.create(pancakes)

      expect((await current()).map((e) => [e.id, e.recipe.title])).toEqual([[id, 'Pancakes']])
    })

    it('refuses an invalid Recipe without a write', async () => {
      // The rules only look at the first Ingredient, so only the schema check catches the second.
      const invalid = { ...pancakes, ingredients: [...pancakes.ingredients, { name: '' }] }

      await expect(store.create(invalid)).rejects.toBeInstanceOf(InvalidRecipeError)

      expect(await current()).toEqual([])
    })
  })

  describe('update', () => {
    it('replaces the Recipe under the same id, dropping optional fields it no longer has', async () => {
      const id = await store.create({ ...pancakes, servings: 4, notes: 'Good' })

      await store.update(id, { ...pancakes, title: 'Thick pancakes' })

      const [entry] = await current()
      expect(entry?.id).toBe(id)
      expect(entry?.recipe).toEqual({ ...pancakes, title: 'Thick pancakes' })
    })

    it('refuses an invalid Recipe without a write', async () => {
      const id = await store.create(pancakes)

      await expect(store.update(id, { ...pancakes, title: '' })).rejects.toBeInstanceOf(InvalidRecipeError)

      expect((await current())[0]?.recipe.title).toBe('Pancakes')
    })
  })
})
