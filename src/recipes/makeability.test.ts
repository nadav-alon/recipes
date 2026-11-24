import { describe, expect, it } from 'vitest'
import type { core, recipes } from 'data-platform'
import { classifyIngredient, classifyRecipe, type ItemsById } from './makeability.ts'

const id = (value: string) => value as core.ItemId

function ingredient(fields: Partial<recipes.Ingredient> = {}): recipes.Ingredient {
  return { name: 'thing', ...fields }
}

const items: ItemsById = new Map([
  [id('flour'), { state: 'enough' }],
  [id('milk'), { state: 'running low' }],
  [id('eggs'), { state: 'out' }],
  [id('out-and-gone'), { state: 'out', deletedAt: { seconds: 1, nanoseconds: 0 } }],
  [id('gone'), { state: 'enough', deletedAt: { seconds: 1, nanoseconds: 0 } }],
])

describe('classifyIngredient', () => {
  it('is at home for an Item that is enough', () => {
    expect(classifyIngredient(ingredient({ itemId: id('flour') }), items, false)).toEqual({ kind: 'at home', runningLow: false })
  })

  it('is at home and running low for an Item that is running low', () => {
    expect(classifyIngredient(ingredient({ itemId: id('milk') }), items, false)).toEqual({
      kind: 'at home',
      runningLow: true,
    })
  })

  it('is Assumed for a marked Ingredient', () => {
    expect(classifyIngredient(ingredient({ assumed: true }), items, false)).toEqual({ kind: 'assumed' })
  })

  it('is Missing as Unlinked with no Item and not Assumed', () => {
    expect(classifyIngredient(ingredient(), items, false)).toEqual({ kind: 'missing', reason: 'unlinked' })
  })

  it('is Bought, not Missing, for an Unlinked Ingredient marked bought on a Wanted Recipe', () => {
    expect(classifyIngredient(ingredient({ bought: true }), items, true)).toEqual({ kind: 'bought' })
  })

  it('is Missing for a bought Unlinked Ingredient once the Recipe is not Wanted', () => {
    expect(classifyIngredient(ingredient({ bought: true }), items, false)).toEqual({ kind: 'missing', reason: 'unlinked' })
  })

  it('is Missing for an Unlinked Ingredient not marked bought on a Wanted Recipe', () => {
    expect(classifyIngredient(ingredient(), items, true)).toEqual({ kind: 'missing', reason: 'unlinked' })
  })

  it('is Missing when the Item is out', () => {
    expect(classifyIngredient(ingredient({ itemId: id('eggs') }), items, false)).toEqual({
      kind: 'missing',
      reason: 'item out',
    })
  })

  it('is Missing as soft-deleted when the Item is soft-deleted, whatever its State', () => {
    for (const itemId of ['gone', 'out-and-gone']) {
      expect(classifyIngredient(ingredient({ itemId: id(itemId) }), items, false)).toEqual({
        kind: 'missing',
        reason: 'item soft-deleted',
      })
    }
  })

  it('is Missing as soft-deleted when the linked id is absent from the Items', () => {
    expect(classifyIngredient(ingredient({ itemId: id('nowhere') }), items, false)).toEqual({
      kind: 'missing',
      reason: 'item soft-deleted',
    })
  })
})

function recipe(...ingredients: recipes.Ingredient[]): recipes.Recipe {
  return { title: 'Dish', ingredients, prepSteps: [], steps: [] }
}

describe('classifyRecipe', () => {
  const have = ingredient({ itemId: id('flour') })
  const lack = ingredient({ itemId: id('eggs') })

  it('is Makeable with no Missing Ingredient, counting running low and Assumed as not Missing', () => {
    const result = classifyRecipe(
      recipe(have, ingredient({ itemId: id('milk') }), ingredient({ assumed: true })),
      items,
    )
    expect(result.makeability).toBe('makeable')
    expect(result.missing).toBe(0)
  })

  it('is Makeable with no Ingredients', () => {
    expect(classifyRecipe(recipe(), items).makeability).toBe('makeable')
  })

  it('is Almost makeable with one or two Missing', () => {
    expect(classifyRecipe(recipe(have, lack), items)).toMatchObject({
      makeability: 'almost makeable',
      missing: 1,
    })
    expect(classifyRecipe(recipe(have, lack, ingredient()), items)).toMatchObject({
      makeability: 'almost makeable',
      missing: 2,
    })
  })

  it('is neither with three or more Missing', () => {
    expect(
      classifyRecipe(recipe(lack, ingredient(), ingredient({ itemId: id('gone') })), items),
    ).toMatchObject({ makeability: 'neither', missing: 3 })
  })

  it('carries each Ingredient status in the Recipe order', () => {
    expect(classifyRecipe(recipe(lack, have), items).ingredients).toEqual([
      { kind: 'missing', reason: 'item out' },
      { kind: 'at home', runningLow: false },
    ])
  })
})

describe('classifyRecipe missingIngredients', () => {
  it('lists the Missing Ingredients in Recipe order with their reasons', () => {
    const lack = ingredient({ itemId: id('eggs'), name: 'eggs' })
    const unlinked = ingredient({ name: 'saffron' })
    const gone = ingredient({ itemId: id('gone'), name: 'flour' })
    const have = ingredient({ itemId: id('flour') })
    const result = classifyRecipe(recipe(lack, have, unlinked, gone), items)
    expect(result.missingIngredients).toEqual([
      { ingredient: lack, reason: 'item out' },
      { ingredient: unlinked, reason: 'unlinked' },
      { ingredient: gone, reason: 'item soft-deleted' },
    ])
  })
})

describe('classifyRecipe with a Bought Ingredient', () => {
  const recipe = (wanted: boolean): recipes.Recipe => ({
    title: 'Pancakes',
    ...(wanted ? { wanted: true as const } : {}),
    ingredients: [ingredient({ bought: true })],
    prepSteps: [],
    steps: [],
  })

  it('is Makeable while Wanted', () => {
    const result = classifyRecipe(recipe(true), items)
    expect(result.makeability).toBe('makeable')
    expect(result.missing).toBe(0)
  })

  it('has the Ingredient Missing when not Wanted', () => {
    expect(classifyRecipe(recipe(false), items).missing).toBe(1)
  })
})
