import { classifyRecipe, titleOrder, type ItemsById, type RecipeMakeability } from '../recipes/makeability.ts'
import type { RecipeEntry } from '../recipes/recipe-store.ts'

export interface ClassifiedEntry {
  readonly entry: RecipeEntry
  readonly classification: RecipeMakeability
}

export interface HomeSections {
  /** Makeable Recipes, by title. */
  makeable: ClassifiedEntry[]
  /** Almost makeable Recipes, fewest Missing first, then by title. */
  almostMakeable: ClassifiedEntry[]
  /** Every Recipe in neither group, by title. */
  other: ClassifiedEntry[]
}

/** Splits the live Recipes into the home screen's three sections; each Recipe lands in exactly one. */
export function homeSections(entries: readonly RecipeEntry[], items: ItemsById): HomeSections {
  const byTitle = (a: ClassifiedEntry, b: ClassifiedEntry) => titleOrder.compare(a.entry.recipe.title, b.entry.recipe.title)
  const classified = entries.map((entry) => ({ entry, classification: classifyRecipe(entry.recipe, items) }))
  const group = (makeability: RecipeMakeability['makeability']) =>
    classified.filter((c) => c.classification.makeability === makeability)
  return {
    makeable: group('makeable').sort(byTitle),
    almostMakeable: group('almost makeable').sort(
      (a, b) => a.classification.missing - b.classification.missing || byTitle(a, b),
    ),
    other: group('neither').sort(byTitle),
  }
}
