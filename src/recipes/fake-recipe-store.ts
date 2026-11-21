import { recipes } from 'data-platform'
import { InvalidRecipeError, validatedRecipe, type Recipe, type RecipeEntry, type RecipeId, type RecipeStore } from './recipe-store.ts'

export { InvalidRecipeError }

/** An in-memory `RecipeStore` for screen tests, with the same validation and soft-delete behavior as the real one. */
export function fakeRecipeStore(initial: readonly RecipeEntry[] = []): RecipeStore {
  const stored = new Map<RecipeId, { recipe: Recipe; deleted: boolean }>(
    initial.map((entry) => [entry.id, { recipe: entry.recipe, deleted: false }]),
  )
  const watchers = new Set<(entries: readonly RecipeEntry[]) => void>()
  let nextId = 1

  const live = (): RecipeEntry[] =>
    [...stored].filter(([, s]) => !s.deleted).map(([id, s]) => ({ id, recipe: s.recipe }))
  const notify = () => watchers.forEach((w) => w(live()))
  const existing = (id: RecipeId) => {
    const entry = stored.get(id)
    if (!entry) throw new Error(`No Recipe ${id}`)
    return entry
  }

  return {
    watch(onChange) {
      watchers.add(onChange)
      onChange(live())
      return () => watchers.delete(onChange)
    },
    async create(recipe) {
      const { deletedAt: _ignored, ...fields } = validatedRecipe(recipe)
      const id = recipes.recipeId(`fake-${nextId++}`)
      stored.set(id, { recipe: fields, deleted: false })
      notify()
      return id
    },
    async update(id, recipe) {
      const { deletedAt: _ignored, ...fields } = validatedRecipe(recipe)
      existing(id).recipe = fields
      notify()
    },
    async softDelete(id) {
      existing(id).deleted = true
      notify()
    },
    async restore(id) {
      existing(id).deleted = false
      notify()
    },
  }
}
