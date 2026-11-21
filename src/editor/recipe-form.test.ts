import { describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { validatedRecipe, type Recipe } from '../recipes/recipe-store.ts'
import { draftOf, emptyDraft, emptyIngredient, emptyStep, moved, problems, recipeOf } from './recipe-form.ts'

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

describe('problems', () => {
  it('has none for a titled Recipe', () => {
    expect(problems({ ...emptyDraft(), title: 'Soup' })).toEqual([])
  })

  it('says a title is missing', () => {
    expect(problems(emptyDraft())).toEqual(['Give the Recipe a title.'])
  })

  it.each(['Infinity', '1e400', '0x10', '1e2', '-1', '0', 'abc'])('rejects the quantity %s', (quantity) => {
    const draft = { ...emptyDraft(), title: 'Soup', ingredients: [{ ...emptyIngredient(), name: 'Salt', quantity }] }
    expect(problems(draft)).toEqual(['Ingredient 1: the quantity must be a number above zero.'])
  })

  it.each(['2', '0.5', '12.25'])('accepts the quantity %s', (quantity) => {
    const draft = { ...emptyDraft(), title: 'Soup', ingredients: [{ ...emptyIngredient(), name: 'Salt', quantity }] }
    expect(problems(draft)).toEqual([])
  })

  it('says a unit needs a quantity', () => {
    const draft = { ...emptyDraft(), title: 'Soup', ingredients: [{ ...emptyIngredient(), name: 'Salt', unit: 'g' as const }] }
    expect(problems(draft)).toEqual(['Ingredient 1: a unit needs a quantity.'])
  })

  it('says an Ingredient needs a name, a quantity must be positive, and Servings a whole number', () => {
    const draft = {
      ...emptyDraft(),
      title: 'Soup',
      servings: '1.5',
      ingredients: [{ ...emptyIngredient(), quantity: '-2' }],
      steps: [emptyStep('  ')],
      prepSteps: [emptyStep('')],
    }
    expect(problems(draft)).toEqual([
      'Servings must be a whole number above zero.',
      'Ingredient 1 needs a name.',
      'Ingredient 1: the quantity must be a number above zero.',
      'Prep Step 1 is empty.',
      'Step 1 is empty.',
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
