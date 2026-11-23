import { useEffect, useRef, useState } from 'preact/hooks'
import type { core, recipes } from 'data-platform'
import { TopAppBar, TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { showSnackbar } from 'household-ui/ui/Snackbar.tsx'
import RemoveShoppingCart from '~icons/material-symbols/remove-shopping-cart'
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
  unlinked: 'Not in the Catalogue',
  'item out': 'Out',
  'item soft-deleted': 'Deleted in the Catalogue',
}

/** How a flag is coloured; each tone has a rule in screens.css. */
type FlagTone = 'missing' | 'running-low' | 'assumed'

/** An Ingredient's flag: its words (for someone cooking) and its tone. */
interface Flag {
  text: string
  tone: FlagTone
}

/** An Ingredient's flag; null when there is nothing to flag. */
function flag(status: IngredientStatus): Flag | null {
  switch (status.kind) {
    case 'missing':
      return { text: MISSING_REASON[status.reason], tone: 'missing' }
    case 'assumed':
      return { text: 'Assumed', tone: 'assumed' }
    case 'at home':
      return status.runningLow ? { text: 'Running low', tone: 'running-low' } : null
  }
}

/** How each unit is written after a quantity other than 1; abbreviations stay as they are. */
const PLURAL_UNIT: Record<recipes.IngredientUnit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'tsp',
  tbsp: 'tbsp',
  cup: 'cups',
  piece: 'pieces',
}

/** The unit as written after `quantity`: plural unless the quantity is exactly 1; nothing without a quantity or a unit. */
function unitText(unit: recipes.IngredientUnit | undefined, quantity: number | undefined): string | undefined {
  if (unit === undefined || quantity === undefined) return undefined
  return quantity === 1 ? unit : PLURAL_UNIT[unit]
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
  ingredient,
  catalogueHref,
  items,
  busy,
  onActuallyOut,
}: {
  ingredient: recipes.Ingredient
  /** The Catalogue hand-off for an Unlinked Ingredient; absent when it has no name to hand over. */
  catalogueHref?: string
  items: ItemsById
  busy: boolean
  onActuallyOut: (marking: MarkedOut) => void
}) {
  const status = classifyIngredient(ingredient, items)
  const flagged = flag(status)
  const item = ingredient.itemId === undefined ? undefined : items.get(ingredient.itemId)
  const amount = joinParts([ingredient.quantity, unitText(ingredient.unit, ingredient.quantity)], ' ')
  const action =
    status.kind === 'at home' && ingredient.itemId !== undefined && item !== undefined ? (
      <IconButton
        symbol={RemoveShoppingCart}
        label={`${ingredient.name.trim()} is actually out`}
        disabled={busy}
        onClick={() => onActuallyOut({ ingredientName: ingredient.name, itemId: ingredient.itemId!, previous: item.state })}
      />
    ) : status.kind === 'missing' && status.reason === 'unlinked' && catalogueHref !== undefined ? (
      <a href={catalogueHref} aria-label={`Add ${ingredient.name.trim()} to Catalogue`}>
        Add to Catalogue
      </a>
    ) : undefined
  return (
    <ListRow
      headline={ingredient.name}
      supporting={joinParts([amount, ingredient.prepNote], ', ') || undefined}
      muted={status.kind === 'missing'}
      trailing={
        flagged !== null || action !== undefined ? (
          <div class="ingredient-trailing">
            {flagged !== null && <span class={`ingredient-flag ingredient-flag--${flagged.tone}`}>{flagged.text}</span>}
            {action}
          </div>
        ) : undefined
      }
    />
  )
}

export function RecipeView({ recipeId, recipe, items, itemsPort, editHref }: RecipeViewProps) {
  const [inFlight, setInFlight] = useState<ReadonlySet<core.ItemId>>(new Set())
  const [failure, setFailure] = useState<string | null>(null)

  // The Undo closure outlives the render that made it, so its guard reads the writes in flight from a ref.
  const inFlightRef = useRef<ReadonlySet<core.ItemId>>(inFlight)

  const setItemState = (itemId: core.ItemId, state: core.State, then: () => void) => {
    if (inFlightRef.current.has(itemId)) return
    setFailure(null)
    inFlightRef.current = new Set(inFlightRef.current).add(itemId)
    setInFlight(inFlightRef.current)
    itemsPort
      .setItemState(itemId, state)
      .then(then, (error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        const next = new Set(inFlightRef.current)
        next.delete(itemId)
        inFlightRef.current = next
        setInFlight(next)
      })
  }

  const latestItems = useRef(items)
  latestItems.current = items
  // The snackbar outlives this view; once it is gone `latestItems` is frozen, so Undo is not honoured then.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const markOut = (marking: MarkedOut) =>
    setItemState(marking.itemId, 'out', () =>
      showSnackbar({
        text: `${marking.ingredientName} marked as out`,
        action: {
          label: 'Undo',
          // Undo only restores while the Item is still the `out` this view set; a newer State is left alone.
          onAction: () => {
            if (mounted.current && latestItems.current.get(marking.itemId)?.state === 'out') setItemState(marking.itemId, marking.previous, () => {})
          },
        },
      }),
    )

  return (
    <TopAppBar title={recipe.title}>
      <article class="screen">
        <BackButton fallback={HOME_HREF} />
        <TopAppBarActions>
          <Button variant="text" onClick={() => navigate(editHref)}>
            Edit
          </Button>
        </TopAppBarActions>
        {failure !== null && <p role="alert">{failure}</p>}
        {recipe.servings !== undefined && <p>Servings: {recipe.servings}</p>}
        {recipe.sourceUrl !== undefined && (
          <p>
            <a href={recipe.sourceUrl}>Source</a>
          </p>
        )}
        {recipe.ingredients.length > 0 && (
          <section>
            <h2>Ingredients</h2>
            <ul>
              {recipe.ingredients.map((ingredient, index) => (
                <IngredientLine
                  key={index}
                  ingredient={ingredient}
                  catalogueHref={ingredient.name.trim() === '' ? undefined : addToCatalogueHref(recipeId, index, ingredient.name.trim())}
                  items={items}
                  busy={ingredient.itemId !== undefined && inFlight.has(ingredient.itemId)}
                  onActuallyOut={markOut}
                />
              ))}
            </ul>
          </section>
        )}
        {recipe.prepSteps.length > 0 && (
          <section>
            <h2>Prep Steps</h2>
            <StepList steps={recipe.prepSteps} />
          </section>
        )}
        {recipe.steps.length > 0 && (
          <section>
            <h2>Steps</h2>
            <StepList steps={recipe.steps} />
          </section>
        )}
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
