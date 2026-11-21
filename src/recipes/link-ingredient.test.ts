import { describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { linkUnlinkedIngredient } from './link-ingredient.ts'
import type { Recipe } from './recipe-store.ts'

const recipe = {
  title: 'Omelette',
  ingredients: [{ name: 'Egg', itemId: core.itemId('egg') }, { name: 'Salt', assumed: true }, { name: 'Chive' }],
  prepSteps: [],
  steps: [],
} as Recipe

describe('linkUnlinkedIngredient', () => {
  it('links the Unlinked Ingredient with that name at that position', () => {
    expect(linkUnlinkedIngredient(recipe, 2, ' Chive', core.itemId('chives'))?.ingredients[2]).toEqual({ name: 'Chive', itemId: 'chives' })
  })

  it.each([
    ['linked', 0, 'Egg'],
    ['Assumed', 1, 'Salt'],
    ['renamed', 2, 'Parsley'],
    ['missing', 3, 'Chive'],
  ])('leaves the Recipe alone when the line is %s', (_what, index, name) => {
    expect(linkUnlinkedIngredient(recipe, index, name, core.itemId('x'))).toBeUndefined()
  })
})
