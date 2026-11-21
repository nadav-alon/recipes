import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ItemsPort } from './items/items-port.ts'
import { RecipeEditor } from './editor/RecipeEditor.tsx'
import { HomeScreen } from './home/HomeScreen.tsx'
import type { ItemsById } from './recipes/makeability.ts'
import { RecipeView } from './recipes/RecipeView.tsx'
import type { RecipeEntry, RecipeStore } from './recipes/recipe-store.ts'
import { editRecipeHref, HOME_HREF, navigate, recipeHref, useRoute } from './routes.ts'

export interface AppProps {
  recipeStore: RecipeStore
  itemsPort: ItemsPort
}

/** The screen the current URL names. */
export function App({ recipeStore, itemsPort }: AppProps) {
  const route = useRoute()
  switch (route.screen) {
    case 'recipe':
      return <RecipeScreen id={route.id} recipeStore={recipeStore} itemsPort={itemsPort} />
    case 'edit-recipe':
      return <EditScreen id={route.id} recipeStore={recipeStore} />
    case 'new-recipe':
      return <NewRecipeScreen recipeStore={recipeStore} />
    default:
      return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
  }
}

function RecipeScreen({ id, recipeStore, itemsPort }: AppProps & { id: RecipeEntry['id'] }) {
  const [entries, setEntries] = useState<readonly RecipeEntry[] | null>(null)
  const [items, setItems] = useState<ItemsById | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => recipeStore.watch(setEntries, () => setFailed(true)), [recipeStore])
  useEffect(
    () =>
      itemsPort.watchItems(
        (watched) => setItems(new Map(watched.filter((i) => !i.deleted).map((i) => [i.id, { state: i.state }]))),
        () => setFailed(true),
      ),
    [itemsPort],
  )

  if (failed) return <p role="alert">The Recipe could not be loaded.</p>
  if (entries === null || items === null) return null
  const entry = entries.find((e) => e.id === id)
  if (entry === undefined) {
    return (
      <main>
        <p role="alert">This Recipe does not exist.</p>
        <a href={HOME_HREF}>Back to Recipes</a>
      </main>
    )
  }
  return <RecipeView recipe={entry.recipe} items={items} itemsPort={itemsPort} editHref={editRecipeHref(id)} />
}

/** Edits the Recipe, keeping it open once found so a Soft delete's Undo outlives the Recipe leaving the watch. */
function EditScreen({ id, recipeStore }: { id: RecipeEntry['id']; recipeStore: RecipeStore }) {
  const [entries, setEntries] = useState<readonly RecipeEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const opened = useRef<RecipeEntry | null>(null)

  useEffect(() => recipeStore.watch(setEntries, () => setFailed(true)), [recipeStore])

  if (failed) return <p role="alert">The Recipe could not be loaded.</p>
  if (entries === null) return null
  opened.current ??= entries.find((e) => e.id === id) ?? null
  if (opened.current === null) {
    return (
      <main>
        <p role="alert">This Recipe does not exist.</p>
        <a href={HOME_HREF}>Back to Recipes</a>
      </main>
    )
  }
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
  const store = useMemo<RecipeStore>(
    () => ({
      ...recipeStore,
      create: async (recipe) => {
        const id = await recipeStore.create(recipe)
        navigate(recipeHref(id))
        return id
      },
    }),
    [recipeStore],
  )
  return <RecipeEditor store={store} />
}
