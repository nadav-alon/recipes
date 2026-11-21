import { useState } from 'preact/hooks'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
import {
  draftOf,
  emptyDraft,
  emptyIngredient,
  emptyStep,
  moved,
  recipeOf,
  UNITS,
  type IngredientDraft,
  type IngredientUnit,
  type RecipeDraft,
  type StepDraft,
} from './recipe-form.ts'

export interface RecipeEditorProps {
  readonly store: RecipeStore
  /** The Recipe to edit; absent when creating a new one. */
  readonly entry?: RecipeEntry
  /** Called once a save has been handed to the store; offline it does not wait for the server. */
  readonly onSaved?: () => void
}

/** The form that creates a Recipe, or edits `entry`. */
export function RecipeEditor({ store, entry, onSaved }: RecipeEditorProps) {
  const [draft, setDraft] = useState<RecipeDraft>(() => (entry ? draftOf(entry.recipe) : emptyDraft()))
  const [failure, setFailure] = useState<string | null>(null)
  const change = (fields: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...fields }))

  const save = (event: Event) => {
    event.preventDefault()
    const recipe = recipeOf(draft, entry?.recipe)
    const write = entry ? store.update(entry.id, recipe) : store.create(recipe)
    write.catch((error: Error) => setFailure(error.message))
    onSaved?.()
  }

  return (
    <form onSubmit={save}>
      <h1>{entry ? 'Edit Recipe' : 'New Recipe'}</h1>
      <label>
        Title
        <input value={draft.title} onInput={(e) => change({ title: e.currentTarget.value })} />
      </label>
      <label>
        Servings
        <input inputMode="numeric" value={draft.servings} onInput={(e) => change({ servings: e.currentTarget.value })} />
      </label>
      <label>
        Source URL
        <input type="url" value={draft.sourceUrl} onInput={(e) => change({ sourceUrl: e.currentTarget.value })} />
      </label>
      <label>
        Notes
        <textarea value={draft.notes} onInput={(e) => change({ notes: e.currentTarget.value })} />
      </label>
      <fieldset>
        <legend>Ingredients</legend>
        {draft.ingredients.map((ingredient, i) => (
          <IngredientRow
            key={ingredient.key}
            ingredient={ingredient}
            position={i + 1}
            last={i === draft.ingredients.length - 1}
            onChange={(fields) =>
              change({ ingredients: draft.ingredients.map((row, j) => (j === i ? { ...row, ...fields } : row)) })
            }
            onMove={(by) => change({ ingredients: moved(draft.ingredients, i, i + by) })}
            onRemove={() => change({ ingredients: draft.ingredients.filter((_, j) => j !== i) })}
          />
        ))}
        <button type="button" onClick={() => change({ ingredients: [...draft.ingredients, emptyIngredient()] })}>
          Add Ingredient
        </button>
      </fieldset>
      <StepList label="Prep Step" legend="Prep Steps" steps={draft.prepSteps} onChange={(prepSteps) => change({ prepSteps })} />
      <StepList label="Step" legend="Steps" steps={draft.steps} onChange={(steps) => change({ steps })} />
      {failure !== null && <p role="alert">{failure}</p>}
      <button type="submit">Save</button>
    </form>
  )
}

interface IngredientRowProps {
  readonly ingredient: IngredientDraft
  readonly position: number
  readonly last: boolean
  readonly onChange: (fields: Partial<IngredientDraft>) => void
  readonly onMove: (by: -1 | 1) => void
  readonly onRemove: () => void
}

function IngredientRow({ ingredient, position, last, onChange, onMove, onRemove }: IngredientRowProps) {
  const row = `Ingredient ${position}`
  return (
    <div role="group" aria-label={row}>
      <input aria-label={`${row} name`} value={ingredient.name} onInput={(e) => onChange({ name: e.currentTarget.value })} />
      <input
        aria-label={`${row} quantity`}
        inputMode="decimal"
        value={ingredient.quantity}
        onInput={(e) => onChange({ quantity: e.currentTarget.value })}
      />
      <select
        aria-label={`${row} unit`}
        value={ingredient.unit}
        onChange={(e) => onChange({ unit: e.currentTarget.value as IngredientUnit | '' })}
      >
        <option value="">No unit</option>
        {UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      <input
        aria-label={`${row} prep note`}
        value={ingredient.prepNote}
        onInput={(e) => onChange({ prepNote: e.currentTarget.value })}
      />
      <button type="button" disabled={position === 1} onClick={() => onMove(-1)}>
        Move {row} up
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)}>
        Move {row} down
      </button>
      <button type="button" onClick={onRemove}>
        Remove {row}
      </button>
    </div>
  )
}

interface StepListProps {
  /** Singular name of a row, as in "Step 2". */
  readonly label: string
  readonly legend: string
  readonly steps: readonly StepDraft[]
  readonly onChange: (steps: StepDraft[]) => void
}

/** An ordered list of instructions that can be added to, edited, removed and reordered. */
function StepList({ label, legend, steps, onChange }: StepListProps) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {steps.map((step, i) => {
        const row = `${label} ${i + 1}`
        return (
          <div key={step.key} role="group" aria-label={row}>
            <textarea
              aria-label={`${row} text`}
              value={step.text}
              onInput={(e) => {
                const text = e.currentTarget.value
                onChange(steps.map((s, j) => (j === i ? { ...s, text } : s)))
              }}
            />
            <button type="button" disabled={i === 0} onClick={() => onChange(moved(steps, i, i - 1))}>
              Move {row} up
            </button>
            <button type="button" disabled={i === steps.length - 1} onClick={() => onChange(moved(steps, i, i + 1))}>
              Move {row} down
            </button>
            <button type="button" onClick={() => onChange(steps.filter((_, j) => j !== i))}>
              Remove {row}
            </button>
          </div>
        )
      })}
      <button type="button" onClick={() => onChange([...steps, emptyStep()])}>
        Add {label}
      </button>
    </fieldset>
  )
}
