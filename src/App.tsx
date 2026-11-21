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
  const [held, setHeld] = useState<readonly HeldSave[]>([])
  const [newEditorKey, setNewEditorKey] = useState(0)
  const nextHeldKey = useRef(0)
  /** The held new Recipe the New Recipe editor opens on next, set by its "Back to the editor" link. */
  const restoreNext = useRef<HeldSave | null>(null)
  /** What the New Recipe editor opened on, `undefined` while it is not open; it reads its Recipe once, when it mounts. */
  const newEditorOpenedOn = useRef<{ held: HeldSave | null } | undefined>(undefined)
  if (route.screen !== 'new-recipe') newEditorOpenedOn.current = undefined
  else if (newEditorOpenedOn.current === undefined) {
    newEditorOpenedOn.current = { held: restoreNext.current }
    restoreNext.current = null
  }
  const newSeed = newEditorOpenedOn.current?.held ?? null

  const hold = (target: SaveTarget, recipe: Recipe, error: Error) =>
    setHeld((all) => {
      const entry = { key: nextHeldKey.current++, target, recipe, message: error.message }
      // A later refusal of the edit of a Recipe continues the held edit, which its editor reopens on.
      return [...all.filter((h) => target.kind === 'new' || !isEditOf(h, target.id)), entry]
    })
  const release = (entry: HeldSave) => setHeld((all) => all.filter((h) => h.key !== entry.key))

  const screen = (() => {
    switch (route.screen) {
      case 'home':
        return <HomeScreen recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'recipe':
        return <RecipeScreen key={route.id} id={route.id} recipeStore={recipeStore} itemsPort={itemsPort} />
      case 'edit-recipe': {
        const id = route.id
        const target: SaveTarget = { kind: 'edit', id }
        const heldEdit = held.find((h) => isEditOf(h, id)) ?? null
        return (
          <EditScreen
            key={id}
            id={id}
            recipeStore={recipeStore}
            unsaved={heldEdit?.recipe ?? null}
            onUnsavedCleared={() => setHeld((all) => all.filter((h) => !isEditOf(h, id)))}
            onSaveFailed={(recipe, error) => hold(target, recipe, error)}
          />
        )
      }
      case 'new-recipe': {
        const target: SaveTarget = { kind: 'new' }
        return (
          <NewRecipeScreen
            key={newEditorKey}
            recipeStore={recipeStore}
            unsaved={newSeed?.recipe ?? null}
            onUnsavedCleared={() => newSeed && release(newSeed)}
            onSaveFailed={(recipe, error) => hold(target, recipe, error)}
          />
        )
      }
    }
  })()

  // The notice lists the held saves the open editor does not hold: on the New Recipe screen that is
  // every held new Recipe but the one the editor opened on, such as one refused while the user started another.
  const heldByOpenEditor = (entry: HeldSave) =>
    route.screen === 'new-recipe'
      ? entry === newSeed
      : entry.target.kind === 'edit' && route.screen === 'edit-recipe' && route.id === entry.target.id
  const shown = held.filter((entry) => !heldByOpenEditor(entry))

  return (
    <>
      {shown.length > 0 && (
        <UnsavedEditNotice
          held={shown}
          onDismiss={release}
          onBackToEditor={(entry) => {
            // The link names the URL the New Recipe editor may already be on, so reopen it on the held Recipe by hand.
            if (entry.target.kind !== 'new') return
            restoreNext.current = entry
            if (route.screen === 'new-recipe') {
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
interface HeldSave {
  readonly key: number
  readonly target: SaveTarget
  readonly recipe: Recipe
  readonly message: string
}

function isEditOf(held: HeldSave, id: RecipeId): boolean {
  return held.target.kind === 'edit' && held.target.id === id
}

/** How the notice names a held save and where its editor is. */
function describeTarget(target: SaveTarget): { label: string; href: string } {
  return target.kind === 'new'
    ? { label: 'Your new Recipe', href: NEW_RECIPE_HREF }
    : { label: 'Your edit to', href: editRecipeHref(target.id) }
}

/** Tells the user which saves were rejected after their editor had gone, each with the way back to the editor holding it. */
function UnsavedEditNotice({
  held,
  onDismiss,
  onBackToEditor,
}: {
  held: readonly HeldSave[]
  onDismiss: (entry: HeldSave) => void
  onBackToEditor: (entry: HeldSave) => void
}) {
  return (
    <div role="alert">
      <ul>
        {held.map((entry) => {
          const { label, href } = describeTarget(entry.target)
          return (
            <li key={entry.key}>
              <p>
                {label} {entry.recipe.title} was not saved: {entry.message}
              </p>
              <a href={href} onClick={() => onBackToEditor(entry)}>
                Back to the editor
              </a>
              <button type="button" onClick={() => onDismiss(entry)}>
                Dismiss
              </button>
            </li>
          )
        })}
      </ul>
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
