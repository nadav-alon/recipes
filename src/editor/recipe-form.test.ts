import { describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { validatedRecipe, type Recipe } from '../recipes/recipe-store.ts'
import { draftOf, emptyDraft, emptyIngredient, emptyStep, fieldId, fieldProblems, moved, recipeOf } from './recipe-form.ts'

const stew: Recipe = {
  title: 'Stew',
  ingredients: [
    { name: 'Beef', itemId: core.itemId('beef'), quantity: 500, unit: 'g', prepNote: 'cubed' },
    { name: 'Water', assumed: true },
  ],
  prepSteps: ['Cube the beef'],
  steps: ['Simmer'],
  servings: 4,
  sourceUrl: 'https://example.com/stew',
  notes: 'Better next day',
}

describe('fieldProblems', () => {
  it('has none for a titled Recipe', () => {
    expect(fieldProblems({ ...emptyDraft(), title: 'Soup' })).toEqual([])
  })

  it('says a title is missing, about the title field', () => {
    expect(fieldProblems(emptyDraft())).toEqual([{ message: 'Give the Recipe a title.', field: fieldId.title }])
  })

  it.each(['Infinity', '1e400', '0x10', '1e2', '-1', '0', 'abc'])('rejects the quantity %s, about the quantity field', (quantity) => {
    const ingredient = { ...emptyIngredient(), name: 'Salt', quantity }
    expect(fieldProblems({ ...emptyDraft(), title: 'Soup', ingredients: [ingredient] })).toEqual([
      { message: 'Ingredient 1: the quantity must be a number above zero.', field: fieldId.ingredient(ingredient, 'quantity') },
    ])
  })

  it.each(['2', '0.5', '12.25'])('accepts the quantity %s', (quantity) => {
    const draft = { ...emptyDraft(), title: 'Soup', ingredients: [{ ...emptyIngredient(), name: 'Salt', quantity }] }
    expect(fieldProblems(draft)).toEqual([])
  })

  it('says a unit needs a quantity, about the quantity field', () => {
    const ingredient = { ...emptyIngredient(), name: 'Salt', unit: 'g' as const }
    expect(fieldProblems({ ...emptyDraft(), title: 'Soup', ingredients: [ingredient] })).toEqual([
      { message: 'Ingredient 1: a unit needs a quantity.', field: fieldId.ingredient(ingredient, 'quantity') },
    ])
  })

  it('names the field of each problem, in the order the fields appear on the form', () => {
    const ingredient = { ...emptyIngredient(), quantity: '-2' }
    const step = emptyStep('  ')
    const prepStep = emptyStep('')
    const draft = { ...emptyDraft(), title: 'Soup', servings: '1.5', ingredients: [ingredient], steps: [step], prepSteps: [prepStep] }
    expect(fieldProblems(draft)).toEqual([
      { message: 'Servings must be a whole number above zero.', field: fieldId.servings },
      { message: 'Ingredient 1 needs a name.', field: fieldId.ingredient(ingredient, 'name') },
      { message: 'Ingredient 1: the quantity must be a number above zero.', field: fieldId.ingredient(ingredient, 'quantity') },
      { message: 'Prep Step 1 is empty.', field: fieldId.prepStep(prepStep) },
      { message: 'Step 1 is empty.', field: fieldId.step(step) },
    ])
  })
})

describe('recipeOf', () => {
  it('round-trips a Recipe through its draft, keeping links and Assumed marks', () => {
    expect(recipeOf(draftOf(stew), stew)).toEqual(stew)
  })

  it('builds a schema-valid Recipe from a new draft, leaving blank optionals out', () => {
    const recipe = recipeOf({ ...emptyDraft(), title: ' Soup ', ingredients: [{ ...emptyIngredient(), name: 'Salt' }] })
    expect(recipe).toEqual({ title: 'Soup', ingredients: [{ name: 'Salt' }], prepSteps: [], steps: [] })
    expect(() => validatedRecipe(recipe)).not.toThrow()
  })

  it('drops a cleared quantity, unit and prep note from an existing Ingredient', () => {
    const draft = draftOf(stew)
    Object.assign(draft.ingredients[0], { quantity: '', unit: '', prepNote: '' })
    expect(recipeOf(draft, stew).ingredients[0]).toEqual({ name: 'Beef', itemId: 'beef' })
  })
})

describe('moved', () => {
  it('moves a row and ignores a move off either end', () => {
    expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moved(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moved(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c'])
  })
})
