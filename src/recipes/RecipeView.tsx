import { useState } from 'preact/hooks'
import type { core, recipes } from 'data-platform'
import type { ItemsPort } from '../items/items-port.ts'
import { classifyIngredient, type IngredientStatus, type ItemsById, type MissingReason } from './makeability.ts'

export interface RecipeViewProps {
  recipe: recipes.Recipe
  items: ItemsById
  /** Where "actually out" writes an Item's State. */
  itemsPort: ItemsPort
  /** Where the link to the Recipe's editor points. */
  editHref: string
}

/** What "actually out" changed, so Undo can put the Item back. */
interface MarkedOut {
  ingredient: string
  itemId: core.ItemId
  previous: core.State
}

const MISSING_REASON: Record<MissingReason, string> = {
  unlinked: 'not linked to an Item',
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

function IngredientLine({
  ingredient,
  items,
  onActuallyOut,
}: {
  ingredient: recipes.Ingredient
  items: ItemsById
  onActuallyOut: (ingredient: recipes.Ingredient, itemId: core.ItemId, previous: core.State) => void
}) {
  const status = classifyIngredient(ingredient, items)
  const flagged = flag(status)
  const item = ingredient.itemId === undefined ? undefined : items.get(ingredient.itemId)
  const amount = [ingredient.quantity, ingredient.quantity === undefined ? undefined : ingredient.unit]
    .filter((part) => part !== undefined)
    .join(' ')
  return (
    <li aria-label={ingredient.name}>
      {amount !== '' && <span>{amount} </span>}
      <span>{ingredient.name}</span>
      {ingredient.prepNote !== undefined && <span>, {ingredient.prepNote}</span>}
      {flagged !== null && <strong> {flagged}</strong>}
      {status.kind === 'at home' && ingredient.itemId !== undefined && item !== undefined && (
        <button onClick={() => onActuallyOut(ingredient, ingredient.itemId!, item.state)}>Actually out</button>
      )}
    </li>
  )
}

export function RecipeView({ recipe, items, itemsPort, editHref }: RecipeViewProps) {
  const [marked, setMarked] = useState<MarkedOut | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const write = (itemId: core.ItemId, state: core.State, then: () => void) => {
    setFailure(null)
    itemsPort.setItemState(itemId, state).then(then, (error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error))
    })
  }

  return (
    <article>
      <h1>{recipe.title}</h1>
      <a href={editHref}>Edit</a>
      {failure !== null && <p role="alert">{failure}</p>}
      {marked !== null && (
        <p role="status">
          {marked.ingredient} marked out.{' '}
          <button onClick={() => write(marked.itemId, marked.previous, () => setMarked(null))}>Undo</button>
        </p>
      )}
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
            ingredient={ingredient}
            items={items}
            onActuallyOut={(marking, itemId, previous) =>
              write(itemId, 'out', () => setMarked({ ingredient: marking.name, itemId, previous }))
            }
          />
        ))}
      </ul>
      {recipe.prepSteps.length > 0 && (
        <section>
          <h2>Prep Steps</h2>
          <ol>
            {recipe.prepSteps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      )}
      <section>
        <h2>Steps</h2>
        <ol>
          {recipe.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>
      {recipe.notes !== undefined && (
        <section>
          <h2>Notes</h2>
          <p>{recipe.notes}</p>
        </section>
      )}
    </article>
  )
}
