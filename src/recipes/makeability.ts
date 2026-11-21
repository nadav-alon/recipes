import type { core, recipes } from 'data-platform'

/** The part of a Catalogue Item that decides whether an Ingredient linked to it is Missing. */
export type ItemState = Pick<core.Item, 'state' | 'deletedAt'>

export type ItemsById = ReadonlyMap<string, ItemState>

export type MissingReason = 'unlinked' | 'item out' | 'item soft-deleted'

export type IngredientStatus =
  | { kind: 'at home' }
  | { kind: 'at home', runningLow: true }
  | { kind: 'assumed' }
  | { kind: 'missing', reason: MissingReason }

/**
 * Classifies one Ingredient against the Catalogue's Items. A link to an id absent from `items`
 * is treated as soft-deleted: the Catalogue no longer has that Item.
 */
export function classifyIngredient(
  ingredient: recipes.Ingredient,
  items: ItemsById,
): IngredientStatus {
  if (ingredient.assumed) return { kind: 'assumed' }
  if (ingredient.itemId === undefined) return { kind: 'missing', reason: 'unlinked' }
  const item = items.get(ingredient.itemId)
  if (item === undefined || item.deletedAt !== undefined) {
    return { kind: 'missing', reason: 'item soft-deleted' }
  }
  if (item.state === 'out') return { kind: 'missing', reason: 'item out' }
  if (item.state === 'running low') return { kind: 'at home', runningLow: true }
  return { kind: 'at home' }
}

export type Makeability = 'makeable' | 'almost makeable' | 'neither'

export interface RecipeMakeability {
  /** One status per Ingredient, in the Recipe's order. */
  ingredients: IngredientStatus[]
  makeability: Makeability
  /** How many Ingredients are Missing. */
  missing: number
}

/** The most Missing Ingredients a Recipe can have and still be Almost makeable. */
const ALMOST_MAKEABLE_MAX_MISSING = 2

export function classifyRecipe(recipe: recipes.Recipe, items: ItemsById): RecipeMakeability {
  const statuses = recipe.ingredients.map((ingredient) => classifyIngredient(ingredient, items))
  const missing = statuses.filter((status) => status.kind === 'missing').length
  const makeability =
    missing === 0 ? 'makeable' : missing <= ALMOST_MAKEABLE_MAX_MISSING ? 'almost makeable' : 'neither'
  return { ingredients: statuses, makeability, missing }
}

/**
 * The Almost makeable Recipes among `all`, fewest Missing first, then by title. Recipes that are
 * Makeable or neither are left out.
 */
export function rankAlmostMakeable(
  all: readonly recipes.Recipe[],
  items: ItemsById,
): { recipe: recipes.Recipe, result: RecipeMakeability }[] {
  return all
    .map((recipe) => ({ recipe, result: classifyRecipe(recipe, items) }))
    .filter(({ result }) => result.makeability === 'almost makeable')
    .sort(
      (a, b) =>
        a.result.missing - b.result.missing || a.recipe.title.localeCompare(b.recipe.title),
    )
}
