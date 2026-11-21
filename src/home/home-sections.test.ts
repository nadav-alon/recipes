import { describe, expect, it } from 'vitest'
import { core, recipes } from 'data-platform'
import { homeSections } from './home-sections.ts'
import type { RecipeEntry } from '../recipes/recipe-store.ts'
import type { ItemsById } from '../recipes/makeability.ts'

const items: ItemsById = new Map([
  [core.itemId('flour'), { state: 'enough' }],
  [core.itemId('eggs'), { state: 'out' }],
])

const entry = (id: string, title: string, ingredientItems: (string | undefined)[]): RecipeEntry => ({
  id: recipes.recipeId(id),
  recipe: {
    title,
    ingredients: ingredientItems.map((item, i) => ({ name: `i${i}`, ...(item ? { itemId: core.itemId(item) } : {}) })),
    steps: ['cook'],
  } as RecipeEntry['recipe'],
})

describe('homeSections', () => {
  const sections = homeSections(
    [
      entry('1', 'Zucchini bake', ['flour']),
      entry('2', 'Bread', ['flour']),
      entry('3', 'Omelette', ['eggs', 'flour']),
      entry('4', 'Crepes', ['eggs', undefined]),
      entry('5', 'Cake', ['eggs', undefined, 'eggs']),
      entry('6', 'Aioli', ['eggs', undefined, 'eggs']),
    ],
    items,
  )
  const titles = (list: typeof sections.makeable) => list.map((c) => c.entry.recipe.title)

  it('lists Makeable Recipes by title', () => {
    expect(titles(sections.makeable)).toEqual(['Bread', 'Zucchini bake'])
  })

  it('ranks Almost makeable Recipes by how few are Missing, then title', () => {
    expect(titles(sections.almostMakeable)).toEqual(['Omelette', 'Crepes'])
  })

  it('lists every other Recipe by title', () => {
    expect(titles(sections.other)).toEqual(['Aioli', 'Cake'])
  })
})
