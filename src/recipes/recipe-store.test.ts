// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreRecipeStore, type RecipeEntry, type RecipeStore } from './recipe-store.ts'

const pancakes = { title: 'Pancakes', ingredients: [{ name: 'Flour', itemId: 'flour' }], prepSteps: [], steps: ['Fry'] }

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

  const nextEntries = (): Promise<readonly RecipeEntry[]> =>
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

      const entries = await nextEntries()

      expect(entries.map((e) => [e.id, e.recipe.title])).toEqual([['pancakes', 'Pancakes']])
    })

    it('reports an empty list when there are no Recipes', async () => {
      expect(await nextEntries()).toEqual([])
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
})
