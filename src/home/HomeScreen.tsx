import { useEffect, useState } from 'preact/hooks'
import type { ItemsPort } from '../items/items-port.ts'
import type { ItemsById } from '../recipes/makeability.ts'
import type { RecipeEntry, RecipeId, RecipeStore } from '../recipes/recipe-store.ts'
import { homeSections, type ClassifiedEntry } from './home-sections.ts'

export interface HomeScreenProps {
  recipeStore: RecipeStore
  itemsPort: ItemsPort
}

/**
 * The home screen: Makeable Recipes, then Almost makeable ones with what each is Missing, then
 * every other Recipe. Nothing is shown until both the Recipes and the Items have arrived, so a
 * Recipe is never judged against an Item list that has not loaded yet.
 */
export function HomeScreen({ recipeStore, itemsPort }: HomeScreenProps) {
  const [entries, setEntries] = useState<readonly RecipeEntry[] | null>(null)
  const [items, setItems] = useState<ItemsById | null>(null)

  useEffect(() => recipeStore.watch(setEntries), [recipeStore])
  useEffect(
    () =>
      itemsPort.watchItems(
        (watched) =>
          // An Item the Catalogue has soft-deleted is left out: a link to an absent id counts as soft-deleted.
          setItems(new Map(watched.filter((i) => !i.deleted).map((i) => [i.id, { state: i.state }]))),
        () => {},
      ),
    [itemsPort],
  )

  if (entries === null || items === null) return null
  const sections = homeSections(entries, items)

  return (
    <main>
      <h1>Recipes</h1>
      <a href={NEW_RECIPE_HREF}>New Recipe</a>
      <Section title="Makeable" list={sections.makeable} empty="Nothing is makeable from what is at home right now." />
      <Section
        title="Almost makeable"
        list={sections.almostMakeable}
        empty="No Recipe is only one or two Ingredients short."
        showMissing
      />
      <Section title="Other Recipes" list={sections.other} empty="No other Recipes." />
    </main>
  )
}

/** Where creating a Recipe lives. */
export const NEW_RECIPE_HREF = '#/recipes/new'

/** Where a Recipe's view lives. */
export const recipeHref = (id: RecipeId) => `#/recipes/${id}`

interface SectionProps {
  title: string
  list: ClassifiedEntry[]
  /** What the section says when `list` is empty. */
  empty: string
  showMissing?: boolean
}

function Section({ title, list, empty, showMissing = false }: SectionProps) {
  return (
    <section aria-labelledby={`home-${title.replace(/ /g, "-")}`}>
      <h2 id={`home-${title.replace(/ /g, "-")}`}>{title}</h2>
      {list.length === 0 && <p>{empty}</p>}
      <ul>
        {list.map(({ entry, classification }) => (
          <li key={entry.id}>
            <a href={recipeHref(entry.id)}>{entry.recipe.title}</a>
            {showMissing && (
              <span>
                {' '}
                Missing:{' '}
                {entry.recipe.ingredients
                  .filter((_, i) => classification.ingredients[i]?.kind === 'missing')
                  .map((ingredient) => ingredient.name)
                  .join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
