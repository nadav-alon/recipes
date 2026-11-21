import { describe, expect, it } from 'vitest'
import { recipes } from 'data-platform'
import { catalogueReturnHref, editRecipeHref, HOME_HREF, NEW_RECIPE_HREF, parseRoute, recipeHref } from './routes.ts'

const asRecipeId = recipes.recipeId

describe('routes', () => {
  it('gives each screen its own URL and reads it back', () => {
    expect(parseRoute(HOME_HREF)).toEqual({ screen: 'home' })
    expect(parseRoute(NEW_RECIPE_HREF)).toEqual({ screen: 'new-recipe' })
    expect(parseRoute(recipeHref(asRecipeId('r1')))).toEqual({ screen: 'recipe', id: asRecipeId('r1') })
    expect(parseRoute(editRecipeHref(asRecipeId('r1')))).toEqual({ screen: 'edit-recipe', id: asRecipeId('r1') })
  })

  it('reads the return URL from the Catalogue back as a Recipe and an Ingredient position', () => {
    expect(parseRoute(catalogueReturnHref(asRecipeId('a b'), 2))).toEqual({ screen: 'catalogue-return', id: asRecipeId('a b'), ingredient: 2 })
    for (const hash of ['#/recipes/r1/ingredients', '#/recipes/r1/ingredients/x', '#/recipes/r1/ingredients/-1', '#/recipes/r1/ingredients/1/x']) {
      expect(parseRoute(hash)).toEqual({ screen: 'home' })
    }
  })

  it('reads an id back as it was written', () => {
    expect(parseRoute(recipeHref(asRecipeId('a b/c')))).toEqual({ screen: 'recipe', id: asRecipeId('a b/c') })
  })

  it('treats an empty or unknown hash as Home', () => {
    for (const hash of ['', '#', '#/', '#/nope', '#/recipes', '#/recipes/', '#/recipes/r1/x', '#/recipes/%E0%A4%A']) {
      expect(parseRoute(hash)).toEqual({ screen: 'home' })
    }
  })
})
