import { core, recipes } from 'data-platform'
import type { Fixture } from 'data-platform/local'

/**
 * What `npm run ux` adds on top of a data-platform local scenario: a pantry of Items in the
 * Catalogue and the Recipes cooked from them. Each entry is a document the Recipes app reads.
 */
const PANTRY_CATEGORY: Fixture = {
  collection: 'categories',
  id: 'pantry',
  data: { name: 'Pantry', defaultShopId: 'grocery', referenceCount: 4 },
}

/** The kit's Shop counts the Categories that name it; the pantry is a second one. */
const GROCERY_SHOP: Fixture = { collection: 'shops', id: 'grocery', data: { name: 'Grocery', referenceCount: 2 } }

const pantryItem = (id: string, name: string, state: 'enough' | 'running low' | 'out'): Fixture[] => [
  { collection: 'items', id, data: { name, state } },
  { collection: 'catalogueItems', id, data: { categoryId: 'pantry', necessity: 'important' } },
]

const item = core.itemId

const recipe = (id: string, data: recipes.Recipe): Fixture => ({ collection: recipes.RECIPES_COLLECTION, id, data })

/**
 * The `owner-with-items` Household's pantry and Recipes: Pasta and Tomato rice are Makeable (rice is
 * running low, so Tomato rice flags it), Egg fried rice is Almost makeable (eggs are out, no
 * scallions linked), and Shakshuka misses three Ingredients.
 */
const OWNER_WITH_ITEMS: readonly Fixture[] = [
  PANTRY_CATEGORY,
  GROCERY_SHOP,
  ...pantryItem('pasta', 'Pasta', 'enough'),
  ...pantryItem('tomatoes', 'Tomatoes', 'enough'),
  ...pantryItem('rice', 'Rice', 'running low'),
  ...pantryItem('eggs', 'Eggs', 'out'),
  recipe('pasta-pomodoro', {
    title: 'Pasta pomodoro',
    servings: 2,
    ingredients: [
      { name: 'Pasta', itemId: item('pasta'), quantity: 200, unit: 'g' },
      { name: 'Tomatoes', itemId: item('tomatoes'), quantity: 4, unit: 'piece', prepNote: 'chopped' },
      { name: 'Salt', assumed: true },
    ],
    prepSteps: ['Chop the tomatoes.'],
    steps: ['Boil the pasta.', 'Simmer the tomatoes for ten minutes.', 'Toss together.'],
  }),
  recipe('tomato-rice', {
    title: 'Tomato rice',
    servings: 3,
    ingredients: [
      { name: 'Rice', itemId: item('rice'), quantity: 1, unit: 'cup' },
      { name: 'Tomatoes', itemId: item('tomatoes'), quantity: 2, unit: 'piece', prepNote: 'diced' },
      { name: 'Water', assumed: true },
    ],
    prepSteps: ['Rinse the rice.', 'Dice the tomatoes.'],
    steps: ['Fry the tomatoes.', 'Add the rice and two cups of water.', 'Cover and cook until the water is gone.'],
    notes: 'The rice is running low, so this Recipe flags it.',
  }),
  recipe('egg-fried-rice', {
    title: 'Egg fried rice',
    servings: 2,
    ingredients: [
      { name: 'Rice', itemId: item('rice'), quantity: 2, unit: 'cup' },
      { name: 'Eggs', itemId: item('eggs'), quantity: 3, unit: 'piece' },
      { name: 'Scallions', quantity: 2, unit: 'piece', prepNote: 'sliced' },
    ],
    prepSteps: ['Slice the scallions.'],
    steps: ['Scramble the eggs.', 'Fry the rice with the eggs.', 'Finish with the scallions.'],
  }),
  recipe('shakshuka', {
    title: 'Shakshuka',
    servings: 4,
    ingredients: [
      { name: 'Eggs', itemId: item('eggs'), quantity: 4, unit: 'piece' },
      { name: 'Tomatoes', itemId: item('tomatoes'), quantity: 6, unit: 'piece' },
      { name: 'Red peppers', quantity: 2, unit: 'piece', prepNote: 'sliced' },
      { name: 'Feta' },
    ],
    prepSteps: [],
    steps: ['Soften the peppers.', 'Add the tomatoes and simmer.', 'Poach the eggs in the sauce.'],
  }),
]

/** The documents `npm run ux` writes after the kit has seeded `scenario`; none for a scenario with no Recipes of its own. */
export function uxFixtures(scenario: string): readonly Fixture[] {
  return scenario === 'owner-with-items' ? OWNER_WITH_ITEMS : []
}
