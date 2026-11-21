import { addDoc, collection, deleteField, doc, onSnapshot, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
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
 *
 * Writes resolve when the server acknowledges them. Offline, a write is applied to the local cache
 * at once (`watch` shows it) but its promise stays pending until the network returns, so a screen
 * must not block navigation on awaiting it.
 */
export interface RecipeStore {
  /**
   * Calls `onChange` with every live Recipe now and after each change, served from the cache while
   * offline. An empty list means there are none. `onError` is called when the watch fails, for
   * example when the rules deny the read because the user is not a Member; the watch has then ended.
   * Returns the function that stops watching.
   */
  watch(onChange: (entries: readonly RecipeEntry[]) => void, onError?: (error: Error) => void): () => void

  /** Saves a new Recipe and resolves with its id. Rejects with `InvalidRecipeError` before any write. */
  create(recipe: Recipe): Promise<RecipeId>

  /**
   * Replaces the Recipe stored under `id`; fields the schema knows that `recipe` lacks are removed. Whether the
   * Recipe is soft-deleted is left as it was. Rejects with `InvalidRecipeError` before any write.
   */
  update(id: RecipeId, recipe: Recipe): Promise<void>

  /** Sets `deletedAt` on the Recipe, which stops it being listed. The document is kept, never hard-deleted. */
  softDelete(id: RecipeId): Promise<void>

  /** Clears `deletedAt`, so the Recipe is listed again under the same id. */
  restore(id: RecipeId): Promise<void>
}

/** Checks `recipe` against data-platform's schema and returns it without `undefined` fields, which Firestore refuses. */
export function validatedRecipe(recipe: Recipe): Recipe {
  const result = recipes.recipeSchema.safeParse(recipe)
  if (!result.success) {
    throw new InvalidRecipeError(result.error.issues.map((i) => `${i.path.join('.') || 'recipe'}: ${i.message}`))
  }
  return withoutUndefined(result.data)
}

/** What a write carries: `recipe` checked against the schema, without `deletedAt`, which only softDelete and restore change. */
export function validatedFields(recipe: Recipe): Recipe {
  const { deletedAt: _ignored, ...fields } = validatedRecipe(recipe)
  return fields
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

/** Every field the schema knows, bar `deletedAt`; `update` removes those a Recipe lacks. */
const SCHEMA_FIELDS = Object.keys(recipes.recipeSchema.shape).filter((f) => f !== 'deletedAt')

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
      const ref = await addDoc(recipesCollection, validatedFields(recipe))
      return recipes.recipeId(ref.id)
    },

    async update(id, recipe) {
      const fields = validatedFields(recipe)
      const removed = Object.fromEntries(SCHEMA_FIELDS.filter((f) => !(f in fields)).map((f) => [f, deleteField()]))
      await updateDoc(doc(recipesCollection, id), { ...fields, ...removed })
    },

    async softDelete(id) {
      await updateDoc(doc(recipesCollection, id), { deletedAt: serverTimestamp() })
    },

    async restore(id) {
      await updateDoc(doc(recipesCollection, id), { deletedAt: deleteField() })
    },
  }
}
