import { useEffect, useRef, useState } from 'preact/hooks'
import type { ItemsPort } from './items/items-port.ts'
import { useItemsById } from './items/use-items-by-id.ts'
import { RecipeEditor } from './editor/RecipeEditor.tsx'
import { HomeScreen } from './home/HomeScreen.tsx'
import { RecipeView } from './recipes/RecipeView.tsx'
import type { Recipe, RecipeEntry, RecipeId, RecipeStore } from './recipes/recipe-store.ts'
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
  const [unsaved, setUnsaved] = useState<UnsavedEdit | null>(null)
  const notice = unsaved !== null && !(route.screen === 'edit-recipe' && route.id === unsaved.id) && (
    <div role="alert">
      <p>
        Your edit to {unsaved.recipe.title} was not saved: {unsaved.message}
      </p>
      <a href={editRecipeHref(unsaved.id)}>Back to the editor</a>
      <button type="button" onClick={() => setUnsaved(null)}>
        Dismiss
      </button>
    </div>
  )

  const screen = (() => {
    switch (route.screen) {
      case 'home':
        return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'recipe':
        return <RecipeScreen key={route.id} id={route.id} recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'edit-recipe': {
        const id = route.id
        return (
          <EditScreen
            key={id}
            id={id}
            recipeStore={recipeStore}
            unsaved={unsaved?.id === id ? unsaved.recipe : null}
            onSaved={() => setUnsaved(null)}
            onSaveFailed={(recipe, error) => setUnsaved({ id, recipe, message: error.message })}
          />
        )
      }
      case 'new-recipe':
        return <NewRecipeScreen recipeStore={recipeStore} />
    }
  })()

  return (
    <>
      {notice}
      {screen}
    </>
  )
}

/** An edit the store rejected after the editor had already gone, kept so the editor can reopen on it. */
interface UnsavedEdit {
  readonly id: RecipeId
  readonly recipe: Recipe
  readonly message: string
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
function EditScreen({
  id,
  recipeStore,
  unsaved,
  onSaved,
  onSaveFailed,
}: {
  id: RecipeId
  recipeStore: RecipeStore
  /** An edit of this Recipe the store rejected; the editor opens on it rather than on the stored Recipe. */
  unsaved: Recipe | null
  onSaved: () => void
  onSaveFailed: (recipe: Recipe, error: Error) => void
}) {
  const { entries, failed } = useRecipeEntries(recipeStore)
  const opened = useRef<RecipeEntry | null>(null)

  if (failed) return <LoadFailed />
  if (entries === null) return null
  opened.current ??= withUnsaved(entries.find((e) => e.id === id), unsaved)
  if (opened.current === null) return <RecipeNotFound />
  return (
    <RecipeEditor
      store={recipeStore}
      entry={opened.current}
      onSaved={() => {
        onSaved()
        navigate(recipeHref(id))
      }}
      onSaveFailed={onSaveFailed}
      onDeleted={() => navigate(HOME_HREF)}
    />
  )
}

function withUnsaved(entry: RecipeEntry | undefined, unsaved: Recipe | null): RecipeEntry | null {
  if (entry === undefined) return null
  return unsaved === null ? entry : { id: entry.id, recipe: unsaved }
}

/** Creates a Recipe, then shows it; the store generates the id, so it is known without waiting for the server. */
function NewRecipeScreen({ recipeStore }: { recipeStore: RecipeStore }) {
  return <RecipeEditor store={recipeStore} onCreated={(id) => navigate(recipeHref(id))} />
}
