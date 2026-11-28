import { useEffect, useState } from 'preact/hooks'
import type { RecipeEntry, RecipeStore } from './recipe-store.ts'

/**
 * The Recipes as the store has them, `null` until they have arrived, and whether watching them failed.
 * `retry` clears the failure and the Recipes in one update, so no render in between shows stale Recipes,
 * and watches again; `attempt` counts the retries, for a caller to resubscribe what it watches alongside.
 */
export function useRecipeEntries(recipeStore: RecipeStore) {
  const [entries, setEntries] = useState<readonly RecipeEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setEntries(null)
    return recipeStore.watch(setEntries, () => setFailed(true))
  }, [recipeStore, attempt])
  const retry = () => {
    setFailed(false)
    setEntries(null)
    setAttempt((n) => n + 1)
  }
  return { entries, failed, fail: () => setFailed(true), retry, attempt }
}
