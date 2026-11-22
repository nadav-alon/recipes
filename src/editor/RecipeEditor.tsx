import { useEffect, useRef, useState } from 'preact/hooks'
import type { core } from 'data-platform'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { Dialog } from 'household-ui/ui/Dialog.tsx'
import { FieldError } from 'household-ui/ui/FieldError.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { Select } from 'household-ui/ui/Select.tsx'
import { showSnackbar } from 'household-ui/ui/Snackbar.tsx'
import { TextArea } from 'household-ui/ui/TextArea.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { ItemsPort, WatchedItem } from '../items/items-port.ts'
import { InvalidRecipeError, validatedRecipe, type Recipe, type RecipeEntry, type RecipeId, type RecipeStore } from '../recipes/recipe-store.ts'
import { BackButton } from '../shell/BackButton.tsx'
import { HOME_HREF, addToCatalogueHref, recipeHref } from '../routes.ts'
import {
  draftOf,
  isClean,
  emptyDraft,
  emptyIngredient,
  emptyStep,
  linkedTo,
  UNLINKED,
  ASSUMED,
  moved,
  problems,
  recipeOf,
  UNITS,
  updated,
  without,
  type IngredientDraft,
  type IngredientLink,
  type IngredientUnit,
  type RecipeDraft,
  type StepDraft,
} from './recipe-form.ts'

export interface RecipeEditorProps {
  readonly store: RecipeStore
  /** Where the Items an Ingredient can be linked to are read from. */
  readonly itemsPort: ItemsPort
  /** The Recipe to edit; absent when creating a new one. */
  readonly entry?: RecipeEntry
  /** The Recipe the form opens on, in place of `entry`'s or an empty one: an unsaved Recipe the store refused. */
  readonly initial?: Recipe
  /** Called once a save has been handed to the store; offline it does not wait for the server. */
  readonly onSaved?: () => void
  /**
   * Called when the store rejects a save that `onSaved` or `onCreated` has already reported, with the Recipe
   * that was not saved, so a parent that has left the editor can keep it.
   */
  readonly onSaveFailed?: (recipe: Recipe, error: Error) => void
  /** Called with the new Recipe's id once the store has applied creating it, offline too; never called when editing. */
  readonly onCreated?: (id: RecipeId) => void
  /**
   * Called once the Recipe is Soft deleted and the Undo offer has ended unused (timed out or replaced by another message), so a
   * parent that closes the editor here does not take Undo with it. Not called when Undo is used.
   */
  readonly onDeleted?: () => void
}

/** The form that creates a Recipe, or edits `entry`. */
export function RecipeEditor({ store, itemsPort, entry, initial, onSaved, onSaveFailed, onCreated, onDeleted }: RecipeEditorProps) {
  const seed = initial ?? entry?.recipe
  const [draft, setDraft] = useState<RecipeDraft>(() => (seed ? draftOf(seed) : emptyDraft()))
  const [failure, setFailure] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<string[]>([])
  const [deletion, setDeletion] = useState<'none' | 'undoable' | 'final'>('none')
  const [items, setItems] = useState<readonly WatchedItem[] | null>(null)
  const [itemsFailed, setItemsFailed] = useState(false)
  useEffect(() => itemsPort.watchItems(setItems, () => setItemsFailed(true)), [itemsPort])
  const onDeletedRef = useRef(onDeleted)
  onDeletedRef.current = onDeleted
  const deleted = deletion !== 'none'
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const change = (fields: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...fields }))

  const save = (event: Event) => {
    event.preventDefault()
    const recipe = recipeOf(draft, seed)
    const found = problems(draft)
    if (found.length === 0) found.push(...schemaProblems(recipe))
    setBlockers(found)
    if (found.length > 0) return
    setFailure(null)
    const refused = (error: Error) => {
      onSaveFailed?.(recipe, error)
      setFailure(error.message)
    }
    if (entry) {
      store.update(entry.id, recipe).catch(refused)
    } else {
      // A server refusal reaches `refused` through `create`; only a rejection before any write lands here.
      store
        .create(recipe, refused)
        .then((id) => onCreated?.(id))
        .catch((error: Error) => setFailure(error.message))
    }
    onSaved?.()
  }

  const softDelete = () => {
    if (!entry) return
    store.softDelete(entry.id).catch((error: Error) => setFailure(error.message))
    setDeletion('undoable')
    showSnackbar({
      text: `Deleted ${entry.recipe.title}`,
      action: {
        label: 'Undo',
        onAction: () => {
          store.restore(entry.id).catch((error: Error) => setFailure(error.message))
          setDeletion('none')
        },
      },
      // The message outlives the editor, so an editor the user has already left does not report the deletion.
      onDismiss: () => {
        if (!mounted.current) return
        setDeletion('final')
        onDeletedRef.current?.()
      },
    })
  }

  return (
    <>
      <TopAppBar title={entry ? 'Edit Recipe' : 'New Recipe'}>
        <form onSubmit={save}>
          <BackButton fallback={entry ? recipeHref(entry.id) : HOME_HREF} />
          <TextField label="Title" value={draft.title} onInput={(e) => change({ title: e.currentTarget.value })} />
          <TextField
            label="Servings"
            inputMode="numeric"
            value={draft.servings}
            onInput={(e) => change({ servings: e.currentTarget.value })}
          />
          <TextField
            label="Source URL"
            type="url"
            value={draft.sourceUrl}
            onInput={(e) => change({ sourceUrl: e.currentTarget.value })}
          />
          <TextArea label="Notes" value={draft.notes} onInput={(e) => change({ notes: e.currentTarget.value })} />
          <fieldset>
            <legend>Ingredients</legend>
            <FieldError id="items-load-error" error={itemsFailed ? 'The Items could not be loaded, so Ingredients cannot be linked.' : undefined} />
            {draft.ingredients.map((ingredient, i) => (
              <IngredientRow
                key={ingredient.key}
                ingredient={ingredient}
                items={items}
                position={i + 1}
                last={i === draft.ingredients.length - 1}
                catalogueHref={entry && isClean(draft, entry.recipe) ? addToCatalogue(entry, draft.ingredients[i]) : undefined}
                onChange={(fields) =>
                  change({ ingredients: updated(draft.ingredients, i, fields) })
                }
                onMove={(by) => change({ ingredients: moved(draft.ingredients, i, i + by) })}
                onRemove={() => change({ ingredients: without(draft.ingredients, i) })}
              />
            ))}
            <Button variant="tonal" onClick={() => change({ ingredients: [...draft.ingredients, emptyIngredient()] })}>
              Add Ingredient
            </Button>
          </fieldset>
          <StepList label="Prep Step" legend="Prep Steps" steps={draft.prepSteps} onChange={(prepSteps) => change({ prepSteps })} />
          <StepList label="Step" legend="Steps" steps={draft.steps} onChange={(steps) => change({ steps })} />
          {blockers.length > 0 && (
            <div>
              <p>This Recipe cannot be saved yet:</p>
              {blockers.map((reason, index) => (
                <FieldError key={reason} id={`recipe-problem-${index}`} error={reason} />
              ))}
            </div>
          )}
          <FieldError id="recipe-failure" error={failure ?? undefined} />
          <Button type="submit" disabled={deleted}>
            Save
          </Button>
          {entry && (
            <Button variant="text" destructive disabled={deleted} onClick={softDelete}>
              Delete Recipe
            </Button>
          )}
        </form>
      </TopAppBar>
    </>
  )
}

interface IngredientRowProps {
  readonly ingredient: IngredientDraft
  /** Every Item the Catalogue has, or null until they have arrived. */
  readonly items: readonly WatchedItem[] | null
  readonly position: number
  readonly last: boolean
  /** Where the Catalogue's add-Item hand-off for this Ingredient is; absent when it cannot be offered. */
  readonly catalogueHref?: string
  readonly onChange: (fields: Partial<IngredientDraft>) => void
  readonly onMove: (by: -1 | 1) => void
  readonly onRemove: () => void
}

function IngredientRow({ ingredient, items, position, last, catalogueHref, onChange, onMove, onRemove }: IngredientRowProps) {
  const row = `Ingredient ${position}`
  const link = linkStatus(ingredient.link, items)
  return (
    <div role="group" aria-label={row}>
      <TextField label={`${row} name`} value={ingredient.name} onInput={(e) => onChange({ name: e.currentTarget.value })} />
      <div class="quantity-unit">
        <TextField
          label={`${row} quantity`}
          inputMode="decimal"
          value={ingredient.quantity}
          onInput={(e) => onChange({ quantity: e.currentTarget.value })}
        />
        <Select
          label={`${row} unit`}
          value={ingredient.unit}
          onChange={(e) => onChange({ unit: e.currentTarget.value as IngredientUnit | '' })}
        >
          <option value="">No unit</option>
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Select>
      </div>
      <TextField
        label={`${row} prep note`}
        value={ingredient.prepNote}
        onInput={(e) => onChange({ prepNote: e.currentTarget.value })}
      />
      {link.kind === 'soft-deleted' && (
        <p>
          {row} is linked to {link.item ? `${link.item.name}, ` : ''}an Item the Catalogue has soft-deleted. Pick another
          Item to relink it.
        </p>
      )}
      {link.kind === 'unchecked' && <p>{row} is linked to an Item, but the Items have not loaded to check it.</p>}
      {link.kind === 'live' && (
        <p>
          Linked to {link.item.name} ({link.item.state})
        </p>
      )}
      {ingredient.link.kind === 'linked' && (
        <Button variant="text" onClick={() => onChange({ link: UNLINKED })}>
          Unlink {row}
        </Button>
      )}
      {ingredient.link.kind === 'unlinked' && catalogueHref !== undefined && (
        <a href={catalogueHref} aria-label={`Add ${row} to Catalogue`}>
          Add to Catalogue
        </a>
      )}
      <ul>
        <ListRow
          headline="Assumed"
          control={
            <input
              type="checkbox"
              aria-label={`${row} assumed`}
              checked={ingredient.link.kind === 'assumed'}
              onChange={(e) => onChange({ link: e.currentTarget.checked ? ASSUMED : UNLINKED })}
            />
          }
        />
      </ul>
      <ItemPicker row={row} linked={ingredient.link.kind === 'linked' ? ingredient.link.itemId : null} items={items ?? []} onPick={(item) => onChange({ link: linkedTo(item.id) })} />
      <RowControls label={row} first={position === 1} last={last} onMove={onMove} onRemove={onRemove} />
    </div>
  )
}

/**
 * The Catalogue hand-off for an Ingredient of the saved Recipe `entry`, which the return URL names by its
 * position and name there; absent when the row is not one of the saved Ingredients or has no name to hand over.
 * Following it leaves the editor, so it is only offered while the draft has no unsaved edits to lose.
 */
function addToCatalogue(entry: RecipeEntry, ingredient: IngredientDraft): string | undefined {
  const index = ingredient.base === null ? -1 : entry.recipe.ingredients.indexOf(ingredient.base)
  const name = ingredient.name.trim()
  return index < 0 || name === '' ? undefined : addToCatalogueHref(entry.id, index, name)
}

type LinkStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'live'; readonly item: WatchedItem }
  /** `item` is absent when the Catalogue no longer lists the id, which counts as soft-deleted, as it does for makeability. */
  | { readonly kind: 'soft-deleted'; readonly item?: WatchedItem }
  | { readonly kind: 'unchecked' }

/** What an Ingredient's link to `itemId` amounts to, given the Items the Catalogue has (null until they arrive). */
function linkStatus(link: IngredientLink, items: readonly WatchedItem[] | null): LinkStatus {
  if (link.kind !== 'linked') return { kind: 'none' }
  if (items === null) return { kind: 'unchecked' }
  const item = items.find((candidate) => candidate.id === link.itemId)
  if (item === undefined) return { kind: 'soft-deleted' }
  return item.deleted ? { kind: 'soft-deleted', item } : { kind: 'live', item }
}

interface ItemPickerProps {
  /** The Ingredient's name, as in "Ingredient 2". */
  readonly row: string
  readonly items: readonly WatchedItem[]
  /** The Item the Ingredient is already linked to, which is not offered again. */
  readonly linked: core.ItemId | null
  readonly onPick: (item: WatchedItem) => void
}

/**
 * A dialog that searches the live Items by name, showing each one's State, and offers each match to link to; it lists
 * nothing until something is typed and closes once an Item is picked.
 */
function ItemPicker({ row, items, linked, onPick }: ItemPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const matches =
    needle === ''
      ? []
      : items.filter((item) => !item.deleted && item.id !== linked && item.name.toLowerCase().includes(needle))
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  return (
    <>
      <Button variant="tonal" onClick={() => setOpen(true)}>
        Choose Item for {row}
      </Button>
      <Dialog open={open} title={`${row} Item`} onClose={close} closable>
        <TextField
          label={`${row} Item search`}
          type="search"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          // The dialog sits inside the Recipe's form, where Enter would otherwise save it.
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
        />
        <ul>
          {matches.map((item) => (
            <ListRow
              key={item.id}
              headline={item.name}
              supporting={item.state}
              onActivate={() => {
                onPick(item)
                close()
              }}
            />
          ))}
        </ul>
      </Dialog>
    </>
  )
}

interface StepListProps {
  /** Singular name of a row, as in "Step 2". */
  readonly label: string
  readonly legend: string
  readonly steps: readonly StepDraft[]
  readonly onChange: (steps: StepDraft[]) => void
}

/** An ordered list of Prep Steps or Steps that can be added to, edited, removed and reordered. */
function StepList({ label, legend, steps, onChange }: StepListProps) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {steps.map((step, i) => {
        const row = `${label} ${i + 1}`
        return (
          <div key={step.key} class="step-row" role="group" aria-label={row}>
            <TextArea
              label={`${row} text`}
              value={step.text}
              onInput={(e) => {
                const text = e.currentTarget.value
                onChange(updated(steps, i, { text }))
              }}
            />
            <RowControls
              label={row}
              first={i === 0}
              last={i === steps.length - 1}
              onMove={(by) => onChange(moved(steps, i, i + by))}
              onRemove={() => onChange(without(steps, i))}
            />
          </div>
        )
      })}
      <Button variant="tonal" onClick={() => onChange([...steps, emptyStep()])}>
        Add {label}
      </Button>
    </fieldset>
  )
}

/** What the store's schema would refuse about `recipe`, found before anything is written. */
function schemaProblems(recipe: Recipe): string[] {
  try {
    validatedRecipe(recipe)
    return []
  } catch (error) {
    if (error instanceof InvalidRecipeError) return [...error.issues]
    throw error
  }
}

interface RowControlsProps {
  /** The row's name, as in "Step 2". */
  readonly label: string
  readonly first: boolean
  readonly last: boolean
  readonly onMove: (by: -1 | 1) => void
  readonly onRemove: () => void
}

/** Move up, Move down and Remove for one row of an ordered list. */
function RowControls({ label, first, last, onMove, onRemove }: RowControlsProps) {
  return (
    <>
      <Button variant="text" disabled={first} onClick={() => onMove(-1)}>
        Move {label} up
      </Button>
      <Button variant="text" disabled={last} onClick={() => onMove(1)}>
        Move {label} down
      </Button>
      <Button variant="text" onClick={onRemove}>
        Remove {label}
      </Button>
    </>
  )
}
