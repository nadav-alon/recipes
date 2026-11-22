import { useEffect, useState } from 'preact/hooks'
import type { ItemsPort } from '../items/items-port.ts'
import { useItemsById } from '../items/use-items-by-id.ts'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
import { navigate, NEW_RECIPE_HREF, recipeHref } from '../routes.ts'
import { TopAppBar, TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { Fab } from 'household-ui/ui/Fab.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import Add from '~icons/material-symbols/add'
import { AccountAction } from '../gate/account.tsx'
import { useWideViewport } from './use-wide-viewport.ts'
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
  const wide = useWideViewport()
  const items = useItemsById(itemsPort, () => setFailed(true))

  if (failed)
    return (
      <TopAppBar title="Recipes">
        <p role="alert">The Recipes could not be loaded.</p>
      </TopAppBar>
    )
  if (entries === null || items === null) return null
  const sections = homeSections(entries, items)
  const newRecipe = () => navigate(NEW_RECIPE_HREF)

  return (
    <TopAppBar title="Recipes">
      <main class="screen">
        <AccountAction />
        {wide ? (
          <TopAppBarActions>
            <Button variant="tonal" onClick={newRecipe}>
              New Recipe
            </Button>
          </TopAppBarActions>
        ) : (
          <Fab symbol={Add} label="New Recipe" onClick={newRecipe} />
        )}
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
        {list.map(({ entry, classification }) => {
          const href = recipeHref(entry.id)
          return (
            <ListRow
              key={entry.id}
              headline={entry.recipe.title}
              supporting={showMissing ? `Missing: ${missingNames(classification)}` : undefined}
              href={href}
              onFollow={() => navigate(href)}
            />
          )
        })}
      </ul>
    </section>
  )
}

function missingNames({ missingIngredients }: ClassifiedEntry['classification']): string {
  return missingIngredients
    .map(({ ingredient, reason }) => (reason === 'item soft-deleted' ? `${ingredient.name} (Item deleted)` : ingredient.name))
    .join(', ')
}
