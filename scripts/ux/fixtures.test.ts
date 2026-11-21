import { describe, expect, it } from 'vitest'
import { catalogue, core, recipes, COLLECTION_SCHEMAS } from 'data-platform'
import { scenarioName, seedScenario, type Fixture } from 'data-platform/local'
import { homeSections } from '../../src/home/home-sections.ts'
import type { ItemsById } from '../../src/recipes/makeability.ts'
import { uxFixtures } from './fixtures.ts'

const SCENARIO = scenarioName('owner-with-items')

/** Every document the Household holds once the kit's scenario and the ux fixtures are both written. */
async function allFixtures(): Promise<Fixture[]> {
  const seeded: Fixture[] = []
  await seedScenario(
    {
      set: async (path, data) => {
        const [collection = '', id = ''] = path.split('/')
        seeded.push({ collection, id, data })
      },
    },
    SCENARIO,
  )
  // A later write to the same document replaces the earlier one, as in Firestore.
  const byPath = new Map([...seeded, ...uxFixtures(SCENARIO)].map((f) => [`${f.collection}/${f.id}`, f]))
  return [...byPath.values()]
}

/** The Items the Household holds once the kit's scenario and the ux fixtures are both written. */
async function items(): Promise<ItemsById> {
  return new Map(
    (await allFixtures())
      .filter((f) => f.collection === core.ITEMS_COLLECTION)
      .map((f) => [core.itemId(f.id), f.data as core.Item]),
  )
}

const entries = () =>
  uxFixtures(SCENARIO)
    .filter((f) => f.collection === recipes.RECIPES_COLLECTION)
    .map((f) => ({ id: recipes.recipeId(f.id), recipe: f.data as recipes.Recipe }))

describe('uxFixtures for owner-with-items', () => {
  it('only writes documents that match the platform schemas', () => {
    for (const f of uxFixtures(SCENARIO)) {
      expect(COLLECTION_SCHEMAS[f.collection]?.safeParse(f.data).success, `${f.collection}/${f.id}`).toBe(true)
    }
  })

  it('counts the references to each Category and Shop from what is seeded', async () => {
    const all = await allFixtures()
    const count = (collection: string, field: string, id: string) =>
      all.filter((f) => f.collection === collection && f.data[field] === id).length
    for (const f of all.filter((f) => f.collection === catalogue.CATEGORIES_COLLECTION)) {
      expect(f.data.referenceCount, `categories/${f.id}`).toBe(count(catalogue.CATALOGUE_ITEMS_COLLECTION, 'categoryId', f.id))
    }
    for (const f of all.filter((f) => f.collection === catalogue.SHOPS_COLLECTION)) {
      expect(f.data.referenceCount, `shops/${f.id}`).toBe(count(catalogue.CATEGORIES_COLLECTION, 'defaultShopId', f.id))
    }
  })

  it('fills all three Home groups', async () => {
    const sections = homeSections(entries(), await items())
    expect(sections.makeable.length).toBeGreaterThan(0)
    expect(sections.almostMakeable.length).toBeGreaterThan(0)
    expect(sections.other.length).toBeGreaterThan(0)
  })

  it('has a Recipe with a flagged Ingredient, Prep Steps and Steps', async () => {
    const { makeable } = homeSections(entries(), await items())
    const flagged = makeable.find(
      ({ entry, classification }) =>
        classification.ingredients.some((s) => s.kind === 'at home' && s.runningLow) &&
        entry.recipe.prepSteps.length > 0 &&
        entry.recipe.steps.length > 0,
    )
    expect(flagged).toBeDefined()
  })

  it('links only to Items that exist', async () => {
    const known = await items()
    for (const { recipe } of entries()) {
      for (const { itemId } of recipe.ingredients) if (itemId !== undefined) expect(known.has(itemId)).toBe(true)
    }
  })

  it('writes nothing for a scenario without Recipes of its own', () => {
    expect(uxFixtures(scenarioName('empty'))).toEqual([])
  })
})
