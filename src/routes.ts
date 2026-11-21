import { useEffect, useState } from 'preact/hooks'
import { recipes } from 'data-platform'
import type { RecipeId } from './recipes/recipe-store.ts'

/**
 * The app's screens, each with its own URL. Routes live in the hash as `#/...`, so the real query
 * string stays free for the Catalogue's `itemId` and the path needs no hosting rewrite; the
 * `#config=` fragment never starts with `#/`, so the two cannot be confused.
 */
export type Route =
  | { readonly screen: 'home' }
  | { readonly screen: 'new-recipe' }
  | { readonly screen: 'recipe'; readonly id: RecipeId }
  | { readonly screen: 'edit-recipe'; readonly id: RecipeId }

/** Where the Home screen lives. */
export const HOME_HREF = '#/'

/** Where creating a Recipe lives. */
export const NEW_RECIPE_HREF = '#/recipes/new'

/** Where a Recipe's view lives. */
export const recipeHref = (id: RecipeId) => `#/recipes/${encodeURIComponent(id)}`

/** Where a Recipe's editor lives. */
export const editRecipeHref = (id: RecipeId) => `${recipeHref(id)}/edit`

/** The screen a URL hash names; any hash that names none is the Home screen. */
export function parseRoute(hash: string): Route {
  const [root, id, action, ...rest] = hash.replace(/^#\/?/, '').split('/')
  if (root !== 'recipes' || !id || rest.length > 0) return { screen: 'home' }
  if (action === undefined && id === 'new') return { screen: 'new-recipe' }
  if (action !== undefined && action !== 'edit') return { screen: 'home' }
  let decoded: string
  try {
    decoded = decodeURIComponent(id)
  } catch {
    return { screen: 'home' }
  }
  return { screen: action === undefined ? 'recipe' : 'edit-recipe', id: recipes.recipeId(decoded) }
}

/** The current route, following the hash as links, Back and Forward change it. */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return parseRoute(hash)
}

/** Whether the app has routed since it opened, so the previous history entry is one of its own screens. */
let routed = false
addEventListener('hashchange', () => {
  routed = true
})

/** Whether Back would return to an earlier screen of this app, rather than leave it (a deep link, a shared URL, a fresh launch). */
export const canGoBack = () => routed

/** Goes to `href`, adding a history entry. */
export function navigate(href: string): void {
  location.hash = href
}
