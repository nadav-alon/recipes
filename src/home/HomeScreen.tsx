import { useEffect, useState } from 'preact/hooks'
import type { ItemsPort } from '../items/items-port.ts'
import { useItemsById } from '../items/use-items-by-id.ts'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
import { NEW_RECIPE_HREF, recipeHref } from '../routes.ts'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
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
  const [failed, setFailed] = useState(false)

  useEffect(() => recipeStore.watch(setEntries, () => setFailed(true)), [recipeStore])
  const items = useItemsById(itemsPort, () => setFailed(true))

  if (failed) return <p role="alert">The Recipes could not be loaded.</p>
  if (entries === null || items === null) return null
  const sections = homeSections(entries, items)

  return (
    <TopAppBar title="Recipes">
      <main>
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
    </TopAppBar>
  )
}

interface SectionProps {
  title: string
  list: ClassifiedEntry[]
  /** What the section says when `list` is empty. */
  empty: string
  showMissing?: boolean
}

function Section({ title, list, empty, showMissing = false }: SectionProps) {
  const headingId = `home-${title.replace(/ /g, '-')}`
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {list.length === 0 && <p>{empty}</p>}
      <ul>
        {list.map(({ entry, classification }) => (
          <li key={entry.id}>
            <a href={recipeHref(entry.id)}>{entry.recipe.title}</a>
            {showMissing && (
              <span>
                {' '}
                Missing:{' '}
                {classification.missingIngredients
                  .map(({ ingredient, reason }) =>
                    reason === 'item soft-deleted' ? `${ingredient.name} (Item deleted)` : ingredient.name,
                  )
                  .join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
