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
