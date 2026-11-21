import { useState } from 'preact/hooks'
import type { RecipeEntry, RecipeStore } from '../recipes/recipe-store.ts'
import { draftOf, emptyDraft, recipeOf, type RecipeDraft } from './recipe-form.ts'

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
      {failure !== null && <p role="alert">{failure}</p>}
      <button type="submit">Save</button>
    </form>
  )
}
