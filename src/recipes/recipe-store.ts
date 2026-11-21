import { onSnapshot, collection, type Firestore } from 'firebase/firestore'
import { recipes } from 'data-platform'

export type Recipe = recipes.Recipe
export type RecipeId = recipes.RecipeId

/** A live Recipe with the id it is stored under; the id never changes. */
export interface RecipeEntry {
  readonly id: RecipeId
  readonly recipe: Recipe
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
}

export function firestoreRecipeStore(db: Firestore): RecipeStore {
  return {
    watch(onChange, onError) {
      return onSnapshot(
        collection(db, recipes.RECIPES_COLLECTION),
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
  }
}
