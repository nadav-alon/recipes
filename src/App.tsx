import { useEffect, useRef, useState } from 'preact/hooks'
import type { ItemsPort } from './items/items-port.ts'
import { useItemsById } from './items/use-items-by-id.ts'
import { RecipeEditor } from './editor/RecipeEditor.tsx'
import { HomeScreen } from './home/HomeScreen.tsx'
import { RecipeView } from './recipes/RecipeView.tsx'
import type { RecipeEntry, RecipeId, RecipeStore } from './recipes/recipe-store.ts'
import { editRecipeHref, HOME_HREF, navigate, recipeHref, useRoute } from './routes.ts'

export interface AppProps {
  recipeStore: RecipeStore
  itemsPort: ItemsPort
}

/**
 * The screen the current URL names. Screens showing a Recipe are keyed by its id, so a URL that
 * moves from one Recipe to another remounts them rather than carrying the first Recipe's state over.
 */
export function App({ recipeStore, itemsPort }: AppProps) {
  const route = useRoute()
  switch (route.screen) {
    case 'home':
      return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
    case 'recipe':
      return <RecipeScreen key={route.id} id={route.id} recipeStore={recipeStore} itemsPort={itemsPort} />
    case 'edit-recipe':
      return <EditScreen key={route.id} id={route.id} recipeStore={recipeStore} />
    case 'new-recipe':
      return <NewRecipeScreen recipeStore={recipeStore} />
  }
}

/** The Recipes as the store has them, `null` until they have arrived, and whether watching them failed. */
function useRecipeEntries(recipeStore: RecipeStore) {
  const [entries, setEntries] = useState<readonly RecipeEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => recipeStore.watch(setEntries, () => setFailed(true)), [recipeStore])
  return { entries, failed, fail: () => setFailed(true) }
}

function LoadFailed() {
  return <p role="alert">The Recipe could not be loaded.</p>
}

function RecipeNotFound() {
  return (
    <main>
      <p role="alert">This Recipe does not exist.</p>
      <a href={HOME_HREF}>Back to Recipes</a>
    </main>
  )
}

function RecipeScreen({ id, recipeStore, itemsPort }: AppProps & { id: RecipeId }) {
  const { entries, failed, fail } = useRecipeEntries(recipeStore)
  const items = useItemsById(itemsPort, fail)

  if (failed) return <LoadFailed />
  if (entries === null || items === null) return null
  const entry = entries.find((e) => e.id === id)
  if (entry === undefined) return <RecipeNotFound />
  return <RecipeView recipe={entry.recipe} items={items} itemsPort={itemsPort} editHref={editRecipeHref(id)} />
}

/** Edits the Recipe, keeping it open once found so a Soft delete's Undo outlives the Recipe leaving the watch. */
function EditScreen({ id, recipeStore }: { id: RecipeId; recipeStore: RecipeStore }) {
  const { entries, failed } = useRecipeEntries(recipeStore)
  const opened = useRef<RecipeEntry | null>(null)

  if (failed) return <LoadFailed />
  if (entries === null) return null
  opened.current ??= entries.find((e) => e.id === id) ?? null
  if (opened.current === null) return <RecipeNotFound />
  return (
    <RecipeEditor
      store={recipeStore}
      entry={opened.current}
      onSaved={() => navigate(recipeHref(id))}
      onDeleted={() => navigate(HOME_HREF)}
    />
  )
}

/** Creates a Recipe, then shows it; the id is only known once the store has acknowledged the write. */
function NewRecipeScreen({ recipeStore }: { recipeStore: RecipeStore }) {
  return <RecipeEditor store={recipeStore} onCreated={(id) => navigate(recipeHref(id))} />
}
