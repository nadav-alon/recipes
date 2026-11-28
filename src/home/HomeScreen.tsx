import type { ItemsPort } from '../items/items-port.ts'
import { useItemsById } from '../items/use-items-by-id.ts'
import type { RecipeStore } from '../recipes/recipe-store.ts'
import { useRecipeEntries } from '../recipes/use-recipe-entries.ts'
import { isWanted } from '../recipes/makeability.ts'
import { navigate, NEW_RECIPE_HREF, recipeHref } from '../routes.ts'
import { TopAppBar, TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { AlertBanner } from 'household-ui/ui/AlertBanner.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { Fab } from 'household-ui/ui/Fab.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import ChevronRight from '~icons/material-symbols/chevron-right'
import Add from '~icons/material-symbols/add'
import { LoadingScreen } from '../shell/LoadingScreen.tsx'
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
  const { entries, failed, fail, retry, attempt } = useRecipeEntries(recipeStore)
  const wide = useWideViewport()
  const items = useItemsById(itemsPort, fail, attempt)

  if (failed)
    return (
      <TopAppBar title="Recipes">
        <main class="screen">
          <AlertBanner message="The Recipes could not be loaded." action={{ label: 'Retry', onAction: retry }} />
        </main>
      </TopAppBar>
    )
  if (entries === null || items === null)
    return <LoadingScreen title="Recipes" label="Loading Recipes" />
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
        <Section title="Other Recipes" list={sections.other} empty="No other Recipes." showMissing />
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
              supporting={showMissing ? missingLabel(classification) : undefined}
              trailing={
                <span class="trailing-cluster">
                  {isWanted(entry.recipe) && <span class="pill wanted-tag">Want to make</span>}
                  <ChevronRight aria-hidden="true" data-testid="recipe-row-chevron" />
                </span>
              }
              href={href}
              onFollow={() => navigate(href)}
            />
          )
        })}
      </ul>
    </section>
  )
}

function missingLabel(classification: ClassifiedEntry['classification']): string {
  return `Missing ${classification.missing}: ${missingNames(classification)}`
}

function missingNames({ missingIngredients }: ClassifiedEntry['classification']): string {
  return missingIngredients
    .map(({ ingredient, reason }) => (reason === 'item soft-deleted' ? `${ingredient.name} (Item deleted)` : ingredient.name))
    .join(', ')
}
