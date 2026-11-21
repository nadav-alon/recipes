import { addDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore'
import { recipes } from 'data-platform'

export type Recipe = recipes.Recipe
export type RecipeId = recipes.RecipeId

/** A live Recipe with the id it is stored under; the id never changes. */
export interface RecipeEntry {
  readonly id: RecipeId
  readonly recipe: Recipe
}

/** A Recipe refused because it does not match data-platform's schema; nothing was written. */
export class InvalidRecipeError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Invalid Recipe: ${issues.join('; ')}`)
    this.name = 'InvalidRecipeError'
    this.issues = issues
  }
}

/**
 * The single port the screens use for Recipes. Only live Recipes are ever listed: a Soft-deleted
 * Recipe disappears from `watch` and comes back through `restore`.
 */
export interface RecipeStore {
  /**
   * Calls `onChange` with every live Recipe now and after each change, served from the cache while
   * offline. An empty list means there are none. Returns the function that stops watching.
   */
  watch(onChange: (entries: readonly RecipeEntry[]) => void, onError?: (error: Error) => void): () => void

  /** Saves a new Recipe and resolves with its id. Rejects with `InvalidRecipeError` before any write. */
  create(recipe: Recipe): Promise<RecipeId>
}

/** Checks `recipe` against data-platform's schema and returns it without `undefined` fields, which Firestore refuses. */
function validated(recipe: Recipe): Recipe {
  const result = recipes.recipeSchema.safeParse(recipe)
  if (!result.success) {
    throw new InvalidRecipeError(result.error.issues.map((i) => `${i.path.join('.') || 'recipe'}: ${i.message}`))
  }
  return withoutUndefined(result.data)
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, withoutUndefined(v)]),
    ) as T
  }
  return value
}

export function firestoreRecipeStore(db: Firestore): RecipeStore {
  const recipesCollection = collection(db, recipes.RECIPES_COLLECTION)
  return {
    watch(onChange, onError) {
      return onSnapshot(
        recipesCollection,
        (snapshot) => {
          const entries: RecipeEntry[] = []
          for (const doc of snapshot.docs) {
            const recipe = doc.data() as Recipe
            if (recipe.deletedAt === undefined) entries.push({ id: recipes.recipeId(doc.id), recipe })
          }
          onChange(entries)
        },
        onError,
      )
    },

    async create(recipe) {
      const { deletedAt: _ignored, ...live } = validated(recipe)
      const ref = await addDoc(recipesCollection, live)
      return recipes.recipeId(ref.id)
    },
  }
}
