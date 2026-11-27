// @vitest-environment node
import { disableNetwork, doc, getDoc, waitForPendingWrites, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { core } from 'data-platform'
import { setIngredientBought } from 'data-platform/client'
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
  let alice: Firestore

  beforeAll(async () => {
    emulator = await startEmulator()
  })
  afterAll(() => emulator.close())
  beforeEach(async () => {
    await emulator.reset(['alice'])
    alice = emulator.client('alice')
    store = firestoreRecipeStore(alice)
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

    it('keeps serving the Recipes it has already seen while offline', async () => {
      await emulator.seed('recipes/pancakes', pancakes)
      await current()

      await disableNetwork(alice)

      expect((await current()).map((e) => e.id)).toEqual(['pancakes'])
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

    it('resolves with the id while offline, and the Recipe is watched at once', async () => {
      await disableNetwork(alice)

      const id = await store.create(pancakes)

      expect((await current()).map((e) => [e.id, e.recipe.title])).toEqual([[id, 'Pancakes']])
    })

    it('calls onRefused when the rules deny the write, and nothing is stored', async () => {
      const outsider = firestoreRecipeStore(emulator.client('mallory'))
      const refused = vi.fn()

      await outsider.create(pancakes, refused)

      await vi.waitFor(() => expect(refused).toHaveBeenCalledTimes(1))
      expect(refused.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(await current()).toEqual([])
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

      // An invalid second Ingredient is caught only by the client-side schema check, not by the rules.
      const invalid = { ...pancakes, ingredients: [...pancakes.ingredients, { name: 'Salt', assumed: true as const, itemId: core.itemId('salt') }] }

      await expect(store.update(id, invalid)).rejects.toBeInstanceOf(InvalidRecipeError)

      expect((await current())[0]?.recipe.title).toBe('Pancakes')
    })
  })

  describe('softDelete and restore', () => {
    it('stops listing a soft-deleted Recipe but keeps its document with deletedAt set', async () => {
      const id = await store.create(pancakes)

      await store.softDelete(id)

      expect(await current()).toEqual([])
      const snapshot = await getDoc(doc(alice, 'recipes', id))
      expect(snapshot.exists()).toBe(true)
      expect(snapshot.data()?.deletedAt).toBeDefined()
    })

    it('lists a restored Recipe again under the same id, without deletedAt', async () => {
      const id = await store.create(pancakes)
      await store.softDelete(id)

      await store.restore(id)

      const [entry] = await current()
      expect(entry?.id).toBe(id)
      expect(entry?.recipe.deletedAt).toBeUndefined()
    })

    it('keeps a soft-deleted Recipe deleted when it is updated', async () => {
      const id = await store.create(pancakes)
      await store.softDelete(id)

      await store.update(id, { ...pancakes, title: 'Renamed' })

      expect(await current()).toEqual([])
    })
  })

  describe('setWanted', () => {
    /** The Recipe once the watch shows it satisfying `ready`; a transaction reaches the watch after it resolves. */
    const recipeWhen = (ready: (recipe: Recipe) => boolean): Promise<Recipe> =>
      new Promise((resolve) => {
        const stop = store.watch((entries) => {
          const recipe = entries[0]?.recipe
          if (recipe !== undefined && ready(recipe)) {
            stop()
            resolve(recipe)
          }
        })
      })

    it('is not undone by an update from a copy made before it', async () => {
      const id = await store.create(pancakes)
      await waitForPendingWrites(alice)
      await store.setWanted(id, true)
      await recipeWhen((r) => r.wanted === true)

      await store.update(id, { ...pancakes, title: 'Stale save' })
      expect((await recipeWhen((r) => r.title === 'Stale save')).wanted).toBe(true)

      await store.setWanted(id, false)
      await recipeWhen((r) => r.wanted === undefined)
      await store.update(id, { ...pancakes, wanted: true, title: 'Stale again' })
      expect((await recipeWhen((r) => r.title === 'Stale again')).wanted).toBeUndefined()
    })

    it('marks a Recipe Wanted and, marking it not Wanted, clears boughtIngredients', async () => {
      const id = await store.create({ ...pancakes, ingredients: [{ name: 'Salt' }] })
      await waitForPendingWrites(alice)

      await store.setWanted(id, true)
      expect((await recipeWhen((r) => r.wanted === true)).wanted).toBe(true)

      await setIngredientBought(alice, id, 'Salt', true)
      await recipeWhen((r) => r.boughtIngredients?.Salt === true)
      await store.setWanted(id, false)
      const recipe = await recipeWhen((r) => r.wanted === undefined)
      expect(recipe.boughtIngredients).toBeUndefined()
    })
  })
})
