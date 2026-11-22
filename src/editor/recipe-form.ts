import { recipes, type core } from 'data-platform'
import type { Recipe } from '../recipes/recipe-store.ts'

export type Ingredient = recipes.Ingredient
export type IngredientUnit = recipes.IngredientUnit

/** The fixed set of units an Ingredient's quantity can be measured in. */
export const UNITS = recipes.INGREDIENT_UNITS

/**
 * An Ingredient as typed into the form. `base` is the stored Ingredient it started from, so what the
 * form does not edit (unknown fields) survives a save. `link` is the link as edited.
 */
/** What an Ingredient is tied to: an Item, nothing, or Assumed (at home without an Item). Never both an Item and Assumed. */
export type IngredientLink =
  | { readonly kind: 'unlinked' }
  | { readonly kind: 'linked'; readonly itemId: core.ItemId }
  | { readonly kind: 'assumed' }

export interface IngredientDraft {
  readonly key: number
  readonly base: Ingredient | null
  link: IngredientLink
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
  return { key: newKey(), base: null, link: UNLINKED, name: '', quantity: '', unit: '', prepNote: '' }
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
      link: linkOf(base),
      name: base.name,
      quantity: base.quantity === undefined ? '' : String(base.quantity),
      unit: base.unit ?? '',
      prepNote: base.prepNote ?? '',
    })),
    prepSteps: recipe.prepSteps.map((text) => emptyStep(text)),
    steps: recipe.steps.map((text) => emptyStep(text)),
  }
}

/** Whether `draft` holds no edits to `recipe`, the Recipe it was drawn from; with no `recipe`, none to an empty draft. */
export function isClean(draft: RecipeDraft, recipe?: Recipe): boolean {
  const withoutKeys = (value: RecipeDraft) => JSON.stringify(value, (name, v) => (name === 'key' ? undefined : v))
  return withoutKeys(draft) === withoutKeys(recipe ? draftOf(recipe) : emptyDraft())
}

/** Plain decimal text (no exponent, hex or `Infinity`) that is finite and above zero. */
function isPositiveDecimal(text: string): boolean {
  return /^\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text)) && Number(text) > 0
}

/** The ids of the form's fields, which a problem names and the editor puts on the inputs. */
export const fieldId = {
  title: 'recipe-field-title',
  servings: 'recipe-field-servings',
  ingredient: (ingredient: IngredientDraft, part: 'name' | 'quantity') => `recipe-field-ingredient-${ingredient.key}-${part}`,
  prepStep: (step: StepDraft) => `recipe-field-prep-step-${step.key}`,
  step: (step: StepDraft) => `recipe-field-step-${step.key}`,
}

/** Why a draft cannot be saved, in the words the form shows; `field` is the id of the field it is about, if one. */
export interface Problem {
  readonly message: string
  readonly field?: string
}

/** What stops a draft being saved, in the order the fields appear on the form; empty when it can be. */
export function fieldProblems(draft: RecipeDraft): Problem[] {
  const found: Problem[] = []
  if (draft.title.trim() === '') found.push({ message: 'Give the Recipe a title.', field: fieldId.title })
  const servings = draft.servings.trim()
  if (servings !== '' && !(Number.isInteger(Number(servings)) && Number(servings) > 0)) {
    found.push({ message: 'Servings must be a whole number above zero.', field: fieldId.servings })
  }
  draft.ingredients.forEach((ingredient, i) => {
    const row = `Ingredient ${i + 1}`
    const quantity = ingredient.quantity.trim()
    if (ingredient.name.trim() === '') found.push({ message: `${row} needs a name.`, field: fieldId.ingredient(ingredient, 'name') })
    if (quantity !== '' && !isPositiveDecimal(quantity)) {
      found.push({ message: `${row}: the quantity must be a number above zero.`, field: fieldId.ingredient(ingredient, 'quantity') })
    }
    if (ingredient.unit !== '' && quantity === '') {
      found.push({ message: `${row}: a unit needs a quantity.`, field: fieldId.ingredient(ingredient, 'quantity') })
    }
  })
  draft.prepSteps.forEach((step, i) => {
    if (step.text.trim() === '') found.push({ message: `Prep Step ${i + 1} is empty.`, field: fieldId.prepStep(step) })
  })
  draft.steps.forEach((step, i) => {
    if (step.text.trim() === '') found.push({ message: `Step ${i + 1} is empty.`, field: fieldId.step(step) })
  })
  return found
}


/** The link to `id`; as an Assumed Ingredient has no Item, linking clears an Assumed mark. */
export function linkedTo(id: core.ItemId): IngredientLink {
  return { kind: 'linked', itemId: id }
}

/** An Ingredient with no Item that is not Assumed. */
export const UNLINKED: IngredientLink = { kind: 'unlinked' }

/** An Assumed Ingredient, which has no Item. */
export const ASSUMED: IngredientLink = { kind: 'assumed' }

/** The link a stored Ingredient has. */
function linkOf(stored: Ingredient | null): IngredientLink {
  if (stored?.assumed === true) return ASSUMED
  return stored?.itemId === undefined ? UNLINKED : linkedTo(stored.itemId as core.ItemId)
}

function sameLink(a: IngredientLink, b: IngredientLink): boolean {
  return a.kind === b.kind && (a.kind !== 'linked' || a.itemId === (b as typeof a).itemId)
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]: V })
}

function ingredientOf(draft: IngredientDraft): Ingredient {
  const { quantity: _q, unit: _u, prepNote: _p, ...stored } = draft.base ?? ({} as Partial<Ingredient>)
  // A link left as it was keeps the stored fields untouched; an edited one replaces them.
  const { itemId: _i, assumed: _a, ...unlinked } = stored
  const linkEdited = !sameLink(draft.link, linkOf(draft.base))
  const kept = linkEdited ? unlinked : stored
  const quantity = draft.quantity.trim()
  const prepNote = draft.prepNote.trim()
  return {
    ...kept,
    name: draft.name.trim(),
    ...(linkEdited
      ? {
          ...(draft.link.kind === 'linked' ? { itemId: draft.link.itemId } : {}),
          ...(draft.link.kind === 'assumed' ? { assumed: true as const } : {}),
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
