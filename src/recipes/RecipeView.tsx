import { useState } from 'preact/hooks'
import type { core, recipes } from 'data-platform'
import { TopAppBar, TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import type { ItemsPort } from '../items/items-port.ts'
import { BackButton } from '../shell/BackButton.tsx'
import { HOME_HREF, addToCatalogueHref, navigate } from '../routes.ts'
import type { RecipeId } from './recipe-store.ts'
import { classifyIngredient, type IngredientStatus, type ItemsById, type MissingReason } from './makeability.ts'

export interface RecipeViewProps {
  /** The Recipe's id, which the Catalogue's return URL names. */
  recipeId: RecipeId
  recipe: recipes.Recipe
  items: ItemsById
  /** Where "actually out" writes an Item's State. */
  itemsPort: ItemsPort
  /** Where the link to the Recipe's editor points. */
  editHref: string
}

/** What "actually out" changed, so Undo can put the Item back. */
interface MarkedOut {
  /** The name of the Ingredient that was marked; the Item is what became `out`. */
  ingredientName: string
  itemId: core.ItemId
  previous: core.State
}

const MISSING_REASON: Record<MissingReason, string> = {
  unlinked: 'Unlinked',
  'item out': 'out',
  'item soft-deleted': 'deleted in the Catalogue',
}

function flag(status: IngredientStatus): string | null {
  switch (status.kind) {
    case 'missing':
      return `Missing: ${MISSING_REASON[status.reason]}`
    case 'assumed':
      return 'Assumed'
    case 'at home':
      return status.runningLow ? 'Running low' : null
  }
}

/** The parts that are present, joined for a row's text. */
function joinParts(parts: ReadonlyArray<string | number | null | undefined>, separator: string): string {
  return parts.filter((part) => part !== undefined && part !== null && part !== '').join(separator)
}

/** Steps in order; the numbers come from a CSS counter (screens.css), so a row's text stays the step alone. */
function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol class="step-list">
      {steps.map((step, index) => (
        <ListRow key={index} headline={step} />
      ))}
    </ol>
  )
}

function IngredientLine({
  recipeId,
  index,
  ingredient,
  items,
  busy,
  onActuallyOut,
}: {
  recipeId: RecipeId
  /** Where the Ingredient is in the Recipe, from 0. */
  index: number
  ingredient: recipes.Ingredient
  items: ItemsById
  busy: boolean
  onActuallyOut: (marking: MarkedOut) => void
}) {
  const status = classifyIngredient(ingredient, items)
  const flagged = flag(status)
  const item = ingredient.itemId === undefined ? undefined : items.get(ingredient.itemId)
  const amount = joinParts([ingredient.quantity, ingredient.quantity === undefined ? undefined : ingredient.unit], ' ')
  return (
    <ListRow
      headline={ingredient.name}
      supporting={joinParts([amount, ingredient.prepNote, flagged], ', ') || undefined}
      muted={status.kind === 'missing'}
      trailing={
        status.kind === 'at home' && ingredient.itemId !== undefined && item !== undefined ? (
          <Button
            variant="tonal"
            disabled={busy}
            onClick={() => onActuallyOut({ ingredientName: ingredient.name, itemId: ingredient.itemId!, previous: item.state })}
          >
            Actually out
          </Button>
        ) : status.kind === 'missing' && status.reason === 'unlinked' ? (
          <a href={addToCatalogueHref(recipeId, index, ingredient.name.trim())} aria-label={`Add ${ingredient.name} to Catalogue`}>
            Add to Catalogue
          </a>
        ) : undefined
      }
    />
  )
}

export function RecipeView({ recipeId, recipe, items, itemsPort, editHref }: RecipeViewProps) {
  const [marked, setMarked] = useState<ReadonlyMap<core.ItemId, MarkedOut>>(new Map())
  const [inFlight, setInFlight] = useState<ReadonlySet<core.ItemId>>(new Set())
  const [failure, setFailure] = useState<string | null>(null)

  const setItemState = (itemId: core.ItemId, state: core.State, then: () => void) => {
    if (inFlight.has(itemId)) return
    setFailure(null)
    setInFlight((current) => new Set(current).add(itemId))
    itemsPort
      .setItemState(itemId, state)
      .then(then, (error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error))
      })
      .finally(() =>
        setInFlight((current) => {
          const next = new Set(current)
          next.delete(itemId)
          return next
        }),
      )
  }

  const remember = (marking: MarkedOut) => setMarked((current) => new Map(current).set(marking.itemId, marking))
  const forget = (itemId: core.ItemId) =>
    setMarked((current) => {
      const next = new Map(current)
      next.delete(itemId)
      return next
    })
  // Undo only restores while the Item is still the `out` this view set; a newer State is left alone.
  const undoable = [...marked.values()].filter((marking) => items.get(marking.itemId)?.state === 'out')

  return (
    <TopAppBar title={recipe.title}>
      <article>
        <BackButton fallback={HOME_HREF} />
        <TopAppBarActions>
          <Button variant="text" onClick={() => navigate(editHref)}>
            Edit
          </Button>
        </TopAppBarActions>
        {failure !== null && <p role="alert">{failure}</p>}
        {undoable.map((marking) => (
          <p role="status" key={marking.itemId}>
            {marking.ingredientName}'s Item marked out.{' '}
            <Button
              variant="text"
              disabled={inFlight.has(marking.itemId)}
              onClick={() => setItemState(marking.itemId, marking.previous, () => forget(marking.itemId))}
            >
              Undo {marking.ingredientName}
            </Button>
          </p>
        ))}
        {recipe.servings !== undefined && <p>Servings: {recipe.servings}</p>}
        {recipe.sourceUrl !== undefined && (
          <p>
            <a href={recipe.sourceUrl}>Source</a>
          </p>
        )}
        <ul>
          {recipe.ingredients.map((ingredient, index) => (
            <IngredientLine
              key={index}
              recipeId={recipeId}
              index={index}
              ingredient={ingredient}
              items={items}
              busy={ingredient.itemId !== undefined && inFlight.has(ingredient.itemId)}
              onActuallyOut={(marking) => setItemState(marking.itemId, 'out', () => remember(marking))}
            />
          ))}
        </ul>
        {recipe.prepSteps.length > 0 && (
          <section>
            <h2>Prep Steps</h2>
            <StepList steps={recipe.prepSteps} />
          </section>
        )}
        <section>
          <h2>Steps</h2>
          <StepList steps={recipe.steps} />
        </section>
        {recipe.notes !== undefined && (
          <section>
            <h2>Notes</h2>
            <p>{recipe.notes}</p>
          </section>
        )}
      </article>
    </TopAppBar>
  )
}
