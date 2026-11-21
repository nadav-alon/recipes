import { useEffect, useState } from 'preact/hooks'
import type { ItemsPort } from '../items/items-port.ts'
import type { ItemsById } from '../recipes/makeability.ts'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
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
      <Section title="Makeable" list={sections.makeable} />
      <Section title="Almost makeable" list={sections.almostMakeable} showMissing />
      <Section title="Other Recipes" list={sections.other} />
    </main>
  )
}

function Section({ title, list, showMissing = false }: { title: string; list: ClassifiedEntry[]; showMissing?: boolean }) {
  return (
    <section aria-labelledby={`home-${title.replace(/ /g, "-")}`}>
      <h2 id={`home-${title.replace(/ /g, "-")}`}>{title}</h2>
      <ul>
        {list.map(({ entry, classification }) => (
          <li key={entry.id}>
            {entry.recipe.title}
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
