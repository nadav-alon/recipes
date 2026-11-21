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
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'recipes' && parts.length === 2 && parts[1] === 'new') return { screen: 'new-recipe' }
  if (parts[0] === 'recipes' && (parts.length === 2 || (parts.length === 3 && parts[2] === 'edit')) && parts[1] !== '') {
    let id: string
    try {
      id = decodeURIComponent(parts[1]!)
    } catch {
      return { screen: 'home' }
    }
    return { screen: parts.length === 2 ? 'recipe' : 'edit-recipe', id: recipes.recipeId(id) }
  }
  return { screen: 'home' }
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

/** Goes to `href`, adding a history entry. */
export function navigate(href: string): void {
  location.hash = href
}
