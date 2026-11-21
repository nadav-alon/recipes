import { catalogue, core, recipes } from 'data-platform'
import type { Fixture, ScenarioName } from 'data-platform/local'

/**
 * What `npm run ux` adds on top of a data-platform local scenario: Items in the Catalogue and the
 * Recipes cooked from them. Each entry is a document the Recipes app reads.
 */
const CUPBOARD_CATEGORY_ID = 'cupboard'

const catalogueItem = (id: string, name: string, state: core.State): Fixture[] => [
  { collection: core.ITEMS_COLLECTION, id, data: { name, state } },
  {
    collection: catalogue.CATALOGUE_ITEMS_COLLECTION,
    id,
    data: { categoryId: CUPBOARD_CATEGORY_ID, necessity: 'important' },
  },
]

const CATALOGUE_ITEMS: readonly Fixture[] = [
  ...catalogueItem('pasta', 'Pasta', 'enough'),
  ...catalogueItem('tomatoes', 'Tomatoes', 'enough'),
  ...catalogueItem('rice', 'Rice', 'running low'),
  ...catalogueItem('eggs', 'Eggs', 'out'),
]

/** How many Categories the kit's scenario seeds under the Grocery Shop, besides the cupboard one. */
const KIT_CATEGORIES_IN_GROCERY = 1

const CUPBOARD_CATEGORY: Fixture = {
  collection: catalogue.CATEGORIES_COLLECTION,
  id: CUPBOARD_CATEGORY_ID,
  data: {
    name: 'Cupboard',
    defaultShopId: 'grocery',
    referenceCount: CATALOGUE_ITEMS.filter((f) => f.collection === catalogue.CATALOGUE_ITEMS_COLLECTION).length,
  },
}

/** The kit's Shop counts the Categories that name it; the cupboard is one more. */
const GROCERY_SHOP: Fixture = {
  collection: catalogue.SHOPS_COLLECTION,
  id: 'grocery',
  data: { name: 'Grocery', referenceCount: KIT_CATEGORIES_IN_GROCERY + 1 },
}

const recipe = (id: string, data: recipes.Recipe): Fixture => ({ collection: recipes.RECIPES_COLLECTION, id, data })

/**
 * The `owner-with-items` Household's Catalogue Items and Recipes: Pasta and Tomato rice are Makeable (rice is
 * running low, so Tomato rice flags it), Egg fried rice is Almost makeable (eggs are out, no
 * scallions linked), and Shakshuka misses three Ingredients.
 */
const OWNER_WITH_ITEMS: readonly Fixture[] = [
  CUPBOARD_CATEGORY,
  GROCERY_SHOP,
  ...CATALOGUE_ITEMS,
  recipe('pasta-pomodoro', {
    title: 'Pasta pomodoro',
    servings: 2,
    ingredients: [
      { name: 'Pasta', itemId: core.itemId('pasta'), quantity: 200, unit: 'g' },
      { name: 'Tomatoes', itemId: core.itemId('tomatoes'), quantity: 4, unit: 'piece', prepNote: 'chopped' },
      { name: 'Salt', assumed: true },
    ],
    prepSteps: ['Chop the tomatoes.'],
    steps: ['Boil the pasta.', 'Simmer the tomatoes for ten minutes.', 'Toss together.'],
  }),
  recipe('tomato-rice', {
    title: 'Tomato rice',
    servings: 3,
    ingredients: [
      { name: 'Rice', itemId: core.itemId('rice'), quantity: 1, unit: 'cup' },
      { name: 'Tomatoes', itemId: core.itemId('tomatoes'), quantity: 2, unit: 'piece', prepNote: 'diced' },
      { name: 'Water', assumed: true },
    ],
    prepSteps: ['Rinse the rice.', 'Dice the tomatoes.'],
    steps: ['Fry the tomatoes.', 'Add the rice and two cups of water.', 'Cover and cook until the water is gone.'],
    notes: 'Good with a fried egg on top.',
  }),
  recipe('egg-fried-rice', {
    title: 'Egg fried rice',
    servings: 2,
    ingredients: [
      { name: 'Rice', itemId: core.itemId('rice'), quantity: 2, unit: 'cup' },
      { name: 'Eggs', itemId: core.itemId('eggs'), quantity: 3, unit: 'piece' },
      { name: 'Scallions', quantity: 2, unit: 'piece', prepNote: 'sliced' },
    ],
    prepSteps: ['Slice the scallions.'],
    steps: ['Scramble the eggs.', 'Fry the rice with the eggs.', 'Finish with the scallions.'],
  }),
  recipe('shakshuka', {
    title: 'Shakshuka',
    servings: 4,
    ingredients: [
      { name: 'Eggs', itemId: core.itemId('eggs'), quantity: 4, unit: 'piece' },
      { name: 'Tomatoes', itemId: core.itemId('tomatoes'), quantity: 6, unit: 'piece' },
      { name: 'Red peppers', quantity: 2, unit: 'piece', prepNote: 'sliced' },
      { name: 'Feta' },
    ],
    prepSteps: [],
    steps: ['Soften the peppers.', 'Add the tomatoes and simmer.', 'Poach the eggs in the sauce.'],
  }),
]

const UX_FIXTURES: Partial<Record<ScenarioName, readonly Fixture[]>> = { 'owner-with-items': OWNER_WITH_ITEMS }

/** The documents `npm run ux` writes after the kit has seeded `scenario`; none for a scenario with no Recipes of its own. */
export function uxFixtures(scenario: ScenarioName): readonly Fixture[] {
  return UX_FIXTURES[scenario] ?? []
}
