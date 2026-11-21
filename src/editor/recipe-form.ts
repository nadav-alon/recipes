import { recipes, type core } from 'data-platform'
import type { Recipe } from '../recipes/recipe-store.ts'

export type Ingredient = recipes.Ingredient
export type IngredientUnit = recipes.IngredientUnit

/** The fixed set of units an Ingredient's quantity can be measured in. */
export const UNITS = recipes.INGREDIENT_UNITS

/**
 * An Ingredient as typed into the form. `base` is the stored Ingredient it started from, so what the
 * form does not edit (unknown fields) survives a save. `itemId` and `assumed` are the link as edited:
 * an Ingredient never has both.
 */
export interface IngredientDraft {
  readonly key: number
  readonly base: Ingredient | null
  itemId: core.ItemId | null
  assumed: boolean
  name: string
  quantity: string
  unit: IngredientUnit | ''
  prepNote: string
}

/** A Prep Step or Step as typed into the form; `key` keeps its row stable while rows move. */
export interface StepDraft {
  readonly key: number
  text: string
}

/** A Recipe as typed into the form. Numbers stay text until saved so a half-typed value is not lost. */
export interface RecipeDraft {
  title: string
  servings: string
  sourceUrl: string
  notes: string
  ingredients: IngredientDraft[]
  prepSteps: StepDraft[]
  steps: StepDraft[]
}

let nextKey = 1
const newKey = (): number => nextKey++

export function emptyIngredient(): IngredientDraft {
  return { key: newKey(), base: null, itemId: null, assumed: false, name: '', quantity: '', unit: '', prepNote: '' }
}

export function emptyStep(text = ''): StepDraft {
  return { key: newKey(), text }
}

/** The draft of a Recipe being created. */
export function emptyDraft(): RecipeDraft {
  return { title: '', servings: '', sourceUrl: '', notes: '', ingredients: [], prepSteps: [], steps: [] }
}

/** The draft of an existing Recipe. */
export function draftOf(recipe: Recipe): RecipeDraft {
  return {
    title: recipe.title,
    servings: recipe.servings === undefined ? '' : String(recipe.servings),
    sourceUrl: recipe.sourceUrl ?? '',
    notes: recipe.notes ?? '',
    ingredients: recipe.ingredients.map((base) => ({
      key: newKey(),
      base,
      itemId: base.itemId === undefined ? null : (base.itemId as core.ItemId),
      assumed: base.assumed === true,
      name: base.name,
      quantity: base.quantity === undefined ? '' : String(base.quantity),
      unit: base.unit ?? '',
      prepNote: base.prepNote ?? '',
    })),
    prepSteps: recipe.prepSteps.map((text) => emptyStep(text)),
    steps: recipe.steps.map((text) => emptyStep(text)),
  }
}

/** Plain decimal text (no exponent, hex or `Infinity`) that is finite and above zero. */
function isPositiveDecimal(text: string): boolean {
  return /^\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && Number(text) > 0
}

/** Why a draft cannot be saved, in the words the form shows; empty when it can. */
export function problems(draft: RecipeDraft): string[] {
  const found: string[] = []
  if (draft.title.trim() === '') found.push('Give the Recipe a title.')
  const servings = draft.servings.trim()
  if (servings !== '' && !(Number.isInteger(Number(servings)) && Number(servings) > 0)) {
    found.push('Servings must be a whole number above zero.')
  }
  draft.ingredients.forEach((ingredient, i) => {
    const row = `Ingredient ${i + 1}`
    const quantity = ingredient.quantity.trim()
    if (ingredient.name.trim() === '') found.push(`${row} needs a name.`)
    if (quantity !== '' && !isPositiveDecimal(quantity)) found.push(`${row}: the quantity must be a number above zero.`)
    if (ingredient.unit !== '' && quantity === '') found.push(`${row}: a unit needs a quantity.`)
  })
  draft.prepSteps.forEach((step, i) => {
    if (step.text.trim() === '') found.push(`Prep Step ${i + 1} is empty.`)
  })
  draft.steps.forEach((step, i) => {
    if (step.text.trim() === '') found.push(`Step ${i + 1} is empty.`)
  })
  return found
}

/** The fields that link an Ingredient to `id`; an Assumed mark is cleared, as an Assumed Ingredient has no Item. */
export function linkedTo(id: core.ItemId): Pick<IngredientDraft, 'itemId' | 'assumed'> {
  return { itemId: id, assumed: false }
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]: V })
}

function ingredientOf(draft: IngredientDraft): Ingredient {
  const { quantity: _q, unit: _u, prepNote: _p, ...stored } = draft.base ?? ({} as Partial<Ingredient>)
  // A link left as it was keeps the stored fields untouched; an edited one replaces them.
  const { itemId: _i, assumed: _a, ...unlinked } = stored
  const linkEdited = draft.itemId !== (draft.base?.itemId ?? null) || draft.assumed !== (draft.base?.assumed === true)
  const kept = linkEdited ? unlinked : stored
  const quantity = draft.quantity.trim()
  const prepNote = draft.prepNote.trim()
  return {
    ...kept,
    name: draft.name.trim(),
    ...(linkEdited
      ? {
          ...optional('itemId', draft.itemId ?? undefined),
          ...optional('assumed', draft.assumed ? (true as const) : undefined),
        }
      : {}),
    ...optional('quantity', quantity === '' ? undefined : Number(quantity)),
    ...optional('unit', draft.unit === '' ? undefined : draft.unit),
    ...optional('prepNote', prepNote === '' ? undefined : prepNote),
  }
}

/**
 * The Recipe a valid draft stands for. `base` is the stored Recipe it started from, if any, so fields
 * the form does not edit are kept.
 */
export function recipeOf(draft: RecipeDraft, base?: Recipe): Recipe {
  const { servings: _s, sourceUrl: _u, notes: _n, ...kept } = base ?? {}
  const servings = draft.servings.trim()
  const sourceUrl = draft.sourceUrl.trim()
  const notes = draft.notes.trim()
  return {
    ...kept,
    title: draft.title.trim(),
    ingredients: draft.ingredients.map(ingredientOf),
    prepSteps: draft.prepSteps.map((s) => s.text.trim()),
    steps: draft.steps.map((s) => s.text.trim()),
    ...optional('servings', servings === '' ? undefined : Number(servings)),
    ...optional('sourceUrl', sourceUrl === '' ? undefined : sourceUrl),
    ...optional('notes', notes === '' ? undefined : notes),
  } as Recipe
}

/** `list` with the row at `from` moved to `to`; out-of-range moves leave it as it was. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from < 0 || from >= list.length) return [...list]
  const next = [...list]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

/** `list` with the row at `index` merged with `fields`. */
export function updated<T>(list: readonly T[], index: number, fields: Partial<T>): T[] {
  return list.map((row, i) => (i === index ? { ...row, ...fields } : row))
}

/** `list` without the row at `index`. */
export function without<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}
