import { useEffect, useRef, useState } from 'preact/hooks'
import type { ItemsPort } from './items/items-port.ts'
import { useItemsById } from './items/use-items-by-id.ts'
import { RecipeEditor, type RecipeEditorProps } from './editor/RecipeEditor.tsx'
import { HomeScreen } from './home/HomeScreen.tsx'
import { RecipeView } from './recipes/RecipeView.tsx'
import type { Recipe, RecipeEntry, RecipeId, RecipeStore } from './recipes/recipe-store.ts'
import { editRecipeHref, HOME_HREF, navigate, NEW_RECIPE_HREF, recipeHref, useRoute } from './routes.ts'

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
  const [newEditorKey, setNewEditorKey] = useState(0)
  /** What the New Recipe editor opened on, `undefined` while it is not open; it reads its Recipe once, when it mounts. */
  const newEditorOpenedOn = useRef<{ unsaved: UnsavedEdit | null } | undefined>(undefined)
  const heldNew = unsaved?.target.kind === 'new' ? unsaved : null
  if (route.screen !== 'new-recipe') newEditorOpenedOn.current = undefined
  else newEditorOpenedOn.current ??= { unsaved: heldNew }

  const screen = (() => {
    switch (route.screen) {
      case 'home':
        return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'recipe':
        return <RecipeScreen key={route.id} id={route.id} recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'edit-recipe': {
        const id = route.id
        const target: SaveTarget = { kind: 'edit', id }
        return (
          <EditScreen
            key={id}
            id={id}
            recipeStore={recipeStore}
            unsaved={isTarget(unsaved, target) ? unsaved.recipe : null}
            onUnsavedCleared={() => setUnsaved((u) => (isTarget(u, target) ? null : u))}
            onSaveFailed={(recipe, error) => setUnsaved({ target, recipe, message: error.message })}
          />
        )
      }
      case 'new-recipe': {
        const target: SaveTarget = { kind: 'new' }
        return (
          <NewRecipeScreen
            key={newEditorKey}
            recipeStore={recipeStore}
            unsaved={heldNew?.recipe ?? null}
            onUnsavedCleared={() => setUnsaved((u) => (isTarget(u, target) ? null : u))}
            onSaveFailed={(recipe, error) => setUnsaved({ target, recipe, message: error.message })}
          />
        )
      }
    }
  })()

  // The notice is for a save the open editor does not hold: on the New Recipe screen that is any held
  // new Recipe the editor did not open on, such as one refused while the user started another.
  const heldByOpenEditor =
    unsaved !== null &&
    (route.screen === 'new-recipe'
      ? unsaved === newEditorOpenedOn.current?.unsaved
      : unsaved.target.kind === 'edit' && route.screen === 'edit-recipe' && route.id === unsaved.target.id)

  return (
    <>
      {unsaved !== null && !heldByOpenEditor && (
        <UnsavedEditNotice
          unsaved={unsaved}
          onDismiss={() => setUnsaved(null)}
          onBackToEditor={() => {
            // The link names the URL the New Recipe editor is already on, so reopen it on the held Recipe by hand.
            if (route.screen === 'new-recipe' && unsaved.target.kind === 'new') {
              newEditorOpenedOn.current = undefined
              setNewEditorKey((k) => k + 1)
            }
          }}
        />
      )}
      {screen}
    </>
  )
}

/**
 * What a save was for: a new Recipe, which has no id the user can return to, or the edit of one.
 */
type SaveTarget = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: RecipeId }

/** A save the store rejected after the editor had already gone, kept so the editor can reopen on it. */
interface UnsavedEdit {
  readonly target: SaveTarget
  readonly recipe: Recipe
  readonly message: string
}

function isTarget(unsaved: UnsavedEdit | null, target: SaveTarget): unsaved is UnsavedEdit {
  if (unsaved === null) return false
  return target.kind === 'new' ? unsaved.target.kind === 'new' : unsaved.target.kind === 'edit' && unsaved.target.id === target.id
}

/** How the notice names a held save and where its editor is. */
function describeTarget(target: SaveTarget): { label: string; href: string } {
  return target.kind === 'new'
    ? { label: 'Your new Recipe', href: NEW_RECIPE_HREF }
    : { label: 'Your edit to', href: editRecipeHref(target.id) }
}

/** Tells the user a save was rejected after the editor had gone, with the way back to the editor holding it. */
function UnsavedEditNotice({
  unsaved,
  onDismiss,
  onBackToEditor,
}: {
  unsaved: UnsavedEdit
  onDismiss: () => void
  onBackToEditor: () => void
}) {
  const { label, href } = describeTarget(unsaved.target)
  return (
    <div role="alert">
      <p>
        {label} {unsaved.recipe.title} was not saved: {unsaved.message}
      </p>
      <a href={href} onClick={onBackToEditor}>
        Back to the editor
      </a>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
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
  onUnsavedCleared,
  onSaveFailed,
}: {
  id: RecipeId
  recipeStore: RecipeStore
  /** An edit of this Recipe the store rejected; the editor opens on it rather than on the stored Recipe. */
  unsaved: Recipe | null
  /** Called when the editor hands the save to the store, so any edit held for this Recipe can be forgotten. */
  onUnsavedCleared: () => void
  onSaveFailed: NonNullable<RecipeEditorProps['onSaveFailed']>
}) {
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
      initial={unsaved ?? undefined}
      onSaved={() => {
        onUnsavedCleared()
        navigate(recipeHref(id))
      }}
      onSaveFailed={onSaveFailed}
      onDeleted={() => navigate(HOME_HREF)}
    />
  )
}

/** Creates a Recipe, then shows it; the store generates the id, so it is known without waiting for the server. */
function NewRecipeScreen({
  recipeStore,
  unsaved,
  onUnsavedCleared,
  onSaveFailed,
}: {
  recipeStore: RecipeStore
  /** A new Recipe the store refused; the editor opens on it rather than empty. */
  unsaved: Recipe | null
  /** Called once the editor has created a Recipe, so any refused new Recipe held can be forgotten. */
  onUnsavedCleared: () => void
  onSaveFailed: NonNullable<RecipeEditorProps['onSaveFailed']>
}) {
  return (
    <RecipeEditor
      store={recipeStore}
      initial={unsaved ?? undefined}
      onCreated={(id) => {
        onUnsavedCleared()
        navigate(recipeHref(id))
      }}
      onSaveFailed={onSaveFailed}
    />
  )
}
