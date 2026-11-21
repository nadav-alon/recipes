import type { core } from 'data-platform'
import type { Recipe } from './recipe-store.ts'

/**
 * `recipe` with its Ingredient at `index` linked to `itemId`, or `undefined` when that line is not the
 * Unlinked, non-Assumed Ingredient called `name` — the Recipe has changed since the Item was asked for.
 */
export function linkUnlinkedIngredient(recipe: Recipe, index: number, name: string, itemId: core.ItemId): Recipe | undefined {
  const target = recipe.ingredients[index]
  if (target === undefined || target.name.trim() !== name.trim() || target.itemId !== undefined || target.assumed === true) return undefined
  return { ...recipe, ingredients: recipe.ingredients.map((ingredient, i) => (i === index ? { ...ingredient, itemId } : ingredient)) }
}
