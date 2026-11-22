import { useEffect, useRef, useState } from 'preact/hooks'
import { core } from 'data-platform'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import type { ItemsPort } from './items/items-port.ts'
import { useItemsById } from './items/use-items-by-id.ts'
import { BackButton } from './shell/BackButton.tsx'
import { RecipeEditor, type RecipeEditorProps } from './editor/RecipeEditor.tsx'
import { HomeScreen } from './home/HomeScreen.tsx'
import { RecipeView } from './recipes/RecipeView.tsx'
import type { Recipe, RecipeEntry, RecipeId, RecipeStore } from './recipes/recipe-store.ts'
import { linkUnlinkedIngredient } from './recipes/link-ingredient.ts'
import { editRecipeHref, HOME_HREF, navigate, NEW_RECIPE_HREF, recipeHref, replace, returnTo, useRoute } from './routes.ts'

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

  // Several held edits of one Recipe stay listed; its editor reopens on the latest.
  const openEdit = route.screen === 'edit-recipe' ? held.findLast((entry) => isEditOf(entry, route.id)) : undefined

  const hold = (target: SaveTarget, recipe: Recipe, error: Error) =>
    setHeld((all) => {
      const entry = { key: nextHeldKey.current++, target, recipe, message: error.message }
      return [...all, entry]
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
        return (
          <EditScreen
            key={id}
            id={id}
            recipeStore={recipeStore}
            itemsPort={itemsPort}
            held={openEdit?.recipe ?? null}
            onHeldCleared={() => openEdit && release(openEdit)}
            onSaveFailed={(recipe, error) => hold(target, recipe, error)}
          />
        )
      }
      case 'catalogue-return':
        return (
          <CatalogueReturnScreen
            key={`${route.id}/${route.ingredientIndex}/${route.name}`}
            id={route.id}
            ingredientIndex={route.ingredientIndex}
            name={route.name}
            recipeStore={recipeStore}
          />
        )
      case 'new-recipe': {
        const target: SaveTarget = { kind: 'new' }
        return (
          <NewRecipeScreen
            key={newEditorKey}
            recipeStore={recipeStore}
            itemsPort={itemsPort}
            held={newSeed?.recipe ?? null}
            onHeldCleared={() => newSeed && release(newSeed)}
            onSaveFailed={(recipe, error) => hold(target, recipe, error)}
          />
        )
      }
    }
  })()

  // The notice lists the held saves the open editor does not hold: on the New Recipe screen that is
  // every held new Recipe but the one the editor opened on, such as one refused while the user started another.
  const heldByOpenEditor = (entry: HeldSave) => (route.screen === 'new-recipe' ? entry === newSeed : entry === openEdit)
  const shown = held.filter((entry) => !heldByOpenEditor(entry))

  return (
    <>
      {shown.length > 0 && (
        <HeldSavesNotice
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

function isEditOf(entry: HeldSave, id: RecipeId): boolean {
  return entry.target.kind === 'edit' && entry.target.id === id
}

/** How the notice names a held save and where its editor is. */
function describeTarget(target: SaveTarget): { label: string; href: string } {
  return target.kind === 'new'
    ? { label: 'Your new Recipe', href: NEW_RECIPE_HREF }
    : { label: 'Your edit to', href: editRecipeHref(target.id) }
}

/** Tells the user which saves were rejected after their editor had gone, each with the way back to the editor holding it. */
function HeldSavesNotice({
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
              <a
                href={href}
                onClick={(e) => {
                  // A click that opens the editor elsewhere leaves this tab's editor alone.
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onBackToEditor(entry)
                }}
              >
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
  return (
    <TopAppBar title="Recipe">
      <BackButton fallback={HOME_HREF} />
      <p role="alert">The Recipe could not be loaded.</p>
    </TopAppBar>
  )
}

function RecipeNotFound() {
  return (
    <TopAppBar title="Recipe not found">
      <BackButton fallback={HOME_HREF} />
      <main>
        <p role="alert">This Recipe does not exist.</p>
      </main>
    </TopAppBar>
  )
}

/**
 * Where the Catalogue's add-Item hand-off returns to, for the Ingredient called `name` at `ingredientIndex`.
 * A returned `itemId` links that Ingredient to the Item and saves the Recipe, provided the line there is still
 * that Unlinked, non-Assumed Ingredient; without an id nothing changes. The `itemId` leaves the URL once it
 * has been dealt with, so that reloading cannot link twice, but stays while a failed save could be retried by
 * reloading; whenever an Item was created but not linked, the user is told which one.
 */
function CatalogueReturnScreen({
  id,
  ingredientIndex,
  name,
  recipeStore,
}: {
  id: RecipeId
  ingredientIndex: number
  name: string
  recipeStore: RecipeStore
}) {
  const { entries, failed } = useRecipeEntries(recipeStore)
  const [notice, setNotice] = useState<string | null>(null)
  const handled = useRef(false)
  const entry = entries?.find((e) => e.id === id)

  useEffect(() => {
    if (entries === null || handled.current) return
    handled.current = true
    const itemId = new URLSearchParams(location.search).get('itemId') || null
    const clearItemId = () => history.replaceState(null, '', `${location.pathname}${location.hash}`)
    if (itemId === null) {
      clearItemId()
      return navigate(entry === undefined ? HOME_HREF : recipeHref(id))
    }
    const unlinked = (why: string) => {
      clearItemId()
      setNotice(`The Catalogue added the Item ${itemId}, but it was not linked: ${why}`)
    }
    if (entry === undefined) return unlinked('this Recipe does not exist.')
    const recipe = linkUnlinkedIngredient(entry.recipe, ingredientIndex, name, core.itemId(itemId))
    if (recipe === undefined) return unlinked(`the Recipe has changed, and ${name} is no longer an Unlinked Ingredient there.`)
    recipeStore.update(id, recipe).then(
      () => {
        clearItemId()
        navigate(recipeHref(id))
      },
      (error: Error) => setNotice(`The Catalogue added the Item ${itemId}, but it could not be linked: ${error.message}`),
    )
  }, [entries, entry, id, ingredientIndex, name, recipeStore])

  if (failed) return <LoadFailed />
  if (notice !== null) {
    return (
      <main>
        <p role="alert">{notice}</p>
        <a href={entry === undefined ? HOME_HREF : recipeHref(id)}>{entry === undefined ? 'Back to Recipes' : 'Back to the Recipe'}</a>
      </main>
    )
  }
  if (entries === null) return null
  if (entry === undefined) return <RecipeNotFound />
  return null
}

function RecipeScreen({ id, recipeStore, itemsPort }: AppProps & { id: RecipeId }) {
  const { entries, failed, fail } = useRecipeEntries(recipeStore)
  const items = useItemsById(itemsPort, fail)

  if (failed) return <LoadFailed />
  if (entries === null || items === null) return null
  const entry = entries.find((e) => e.id === id)
  if (entry === undefined) return <RecipeNotFound />
  return <RecipeView recipeId={id} recipe={entry.recipe} items={items} itemsPort={itemsPort} editHref={editRecipeHref(id)} />
}

/** Edits the Recipe, keeping it open once found so a Soft delete's Undo outlives the Recipe leaving the watch. */
function EditScreen({
  id,
  recipeStore,
  itemsPort,
  held,
  onHeldCleared,
  onSaveFailed,
}: {
  id: RecipeId
  recipeStore: RecipeStore
  itemsPort: ItemsPort
  /** An edit of this Recipe the store rejected; the editor opens on it rather than on the stored Recipe. */
  held: Recipe | null
  /** Called when the editor hands the save to the store, so any edit held for this Recipe can be forgotten. */
  onHeldCleared: () => void
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
      itemsPort={itemsPort}
      entry={opened.current}
      initial={held ?? undefined}
      onSaved={() => {
        onHeldCleared()
        returnTo(recipeHref(id))
      }}
      onSaveFailed={onSaveFailed}
      onDeleted={() => navigate(HOME_HREF)}
    />
  )
}

/** Creates a Recipe, then shows it; the store generates the id, so it is known without waiting for the server. */
function NewRecipeScreen({
  recipeStore,
  itemsPort,
  held,
  onHeldCleared,
  onSaveFailed,
}: {
  recipeStore: RecipeStore
  itemsPort: ItemsPort
  /** A new Recipe the store refused; the editor opens on it rather than empty. */
  held: Recipe | null
  /** Called once the editor has created a Recipe, so any refused new Recipe held can be forgotten. */
  onHeldCleared: () => void
  onSaveFailed: NonNullable<RecipeEditorProps['onSaveFailed']>
}) {
  return (
    <RecipeEditor
      store={recipeStore}
      itemsPort={itemsPort}
      initial={held ?? undefined}
      onCreated={(id) => {
        onHeldCleared()
        replace(recipeHref(id))
      }}
      onSaveFailed={onSaveFailed}
    />
  )
}
