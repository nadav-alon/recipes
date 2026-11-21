import type { recipes } from 'data-platform'
import { classifyIngredient, type IngredientStatus, type ItemsById, type MissingReason } from './makeability.ts'

export interface RecipeViewProps {
  recipe: recipes.Recipe
  items: ItemsById
  /** Where the link to the Recipe's editor points. */
  editHref: string
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

function IngredientLine({ ingredient, items }: { ingredient: recipes.Ingredient; items: ItemsById }) {
  const flagged = flag(classifyIngredient(ingredient, items))
  const amount = [ingredient.quantity, ingredient.quantity === undefined ? undefined : ingredient.unit]
    .filter((part) => part !== undefined)
    .join(' ')
  return (
    <li aria-label={ingredient.name}>
      {amount !== '' && <span>{amount} </span>}
      <span>{ingredient.name}</span>
      {ingredient.prepNote !== undefined && <span>, {ingredient.prepNote}</span>}
      {flagged !== null && <strong> {flagged}</strong>}
    </li>
  )
}

export function RecipeView({ recipe, items, editHref }: RecipeViewProps) {
  return (
    <article>
      <h1>{recipe.title}</h1>
      <a href={editHref}>Edit</a>
      {recipe.servings !== undefined && <p>Servings: {recipe.servings}</p>}
      {recipe.sourceUrl !== undefined && (
        <p>
          <a href={recipe.sourceUrl}>Source</a>
        </p>
      )}
      <ul>
        {recipe.ingredients.map((ingredient, index) => (
          <IngredientLine key={index} ingredient={ingredient} items={items} />
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
