import { recipes } from 'data-platform'
import { validatedFields, type Recipe, type RecipeEntry, type RecipeId, type RecipeStore } from './recipe-store.ts'

/** A `RecipeStore` whose watches can be made to fail, to exercise a screen's error path. */
export interface FakeRecipeStore extends RecipeStore {
  /** Ends every watch, calling each one's `onError` with `error`, as the real store does on a denied read. */
  failWatches(error: Error): void
  /**
   * Makes every later `create` be refused by the "server" once it has resolved, as the real store is by a
   * rules denial: the Recipe leaves `watch` and the `create`'s `onRefused` is called with `error`.
   */
  refuseCreates(error: Error): void
}

/**
 * An in-memory `RecipeStore` for screen tests, with the same validation and soft-delete behavior
 * as the real one: soft-deleting a Recipe that is already soft-deleted is refused, as the rules do.
 */
export function fakeRecipeStore(initial: readonly RecipeEntry[] = []): FakeRecipeStore {
  const stored = new Map<RecipeId, { recipe: Recipe; deleted: boolean }>(
    initial.map((entry) => [entry.id, { recipe: entry.recipe, deleted: false }]),
  )
  const watchers = new Map<(entries: readonly RecipeEntry[]) => void, ((error: Error) => void) | undefined>()
  let nextId = 1
  let creationRefusal: Error | null = null

  const live = (): RecipeEntry[] =>
    [...stored].filter(([, s]) => !s.deleted).map(([id, s]) => ({ id, recipe: s.recipe }))
  const notify = () => watchers.forEach((_, w) => w(live()))
  const existing = (id: RecipeId) => {
    const entry = stored.get(id)
    if (!entry) throw new Error(`No Recipe ${id}`)
    return entry
  }

  return {
    watch(onChange, onError) {
      watchers.set(onChange, onError)
      onChange(live())
      return () => watchers.delete(onChange)
    },
    failWatches(error) {
      const failing = [...watchers.values()]
      watchers.clear()
      failing.forEach((onError) => onError?.(error))
    },
    refuseCreates(error) {
      creationRefusal = error
    },
    async create(recipe, onRefused) {
      const fields = validatedFields(recipe)
      const id = recipes.recipeId(`fake-${nextId++}`)
      stored.set(id, { recipe: fields, deleted: false })
      notify()
      const refusal = creationRefusal
      if (refusal) {
        setTimeout(() => {
          stored.delete(id)
          notify()
          onRefused?.(refusal)
        }, 0)
      }
      return id
    },
    async update(id, recipe) {
      const { wanted: _ignored, ...fields } = validatedFields(recipe)
      const entry = existing(id)
      entry.recipe = entry.recipe.wanted === true ? { ...fields, wanted: true } : fields
      notify()
    },
    async softDelete(id) {
      const entry = existing(id)
      if (entry.deleted) throw new Error(`Recipe ${id} is already soft-deleted`)
      entry.deleted = true
      notify()
    },
    async restore(id) {
      existing(id).deleted = false
      notify()
    },
    async setWanted(id, wanted) {
      const entry = existing(id)
      if (entry.deleted) throw new Error(`Recipe ${id} is soft-deleted`)
      const { wanted: _was, ...rest } = entry.recipe
      entry.recipe = wanted
        ? { ...rest, wanted: true }
        : { ...rest, ingredients: rest.ingredients.map(({ bought: _bought, ...ingredient }) => ingredient) }
      notify()
    },
  }
}
