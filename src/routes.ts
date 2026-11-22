import { useEffect, useState } from 'preact/hooks'
import { recipes } from 'data-platform'
import type { RecipeId } from './recipes/recipe-store.ts'
import { catalogueUrl } from './catalogue-url.ts'

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
  /**
   * Where the Catalogue sends the user back to after adding an Item for one of a Recipe's Ingredients: the
   * Ingredient is the line at `ingredientIndex` (from 0) that was called `name` when the Item was asked for.
   */
  | { readonly screen: 'catalogue-return'; readonly id: RecipeId; readonly ingredientIndex: number; readonly name: string }

/** Where the Home screen lives. */
export const HOME_HREF = '#/'

/** Where creating a Recipe lives. */
export const NEW_RECIPE_HREF = '#/recipes/new'

/** Where a Recipe's view lives. */
export const recipeHref = (id: RecipeId) => `#/recipes/${encodeURIComponent(id)}`

/** Where a Recipe's editor lives. */
export const editRecipeHref = (id: RecipeId) => `${recipeHref(id)}/edit`

/** Where the Catalogue returns to for the Ingredient called `name` at `ingredientIndex` (from 0) of a Recipe. */
export const catalogueReturnHref = (id: RecipeId, ingredientIndex: number, name: string) =>
  `${recipeHref(id)}/ingredients/${ingredientIndex}/${encodeURIComponent(name)}`

/**
 * The Catalogue's add-Item hand-off for the Ingredient called `name` at `ingredientIndex` of the Recipe `id`:
 * it opens the add-Item dialog with that name and, when done, returns to this app's `catalogue-return` route
 * for that Ingredient with the new Item's id as an `itemId` query parameter.
 */
export function addToCatalogueHref(id: RecipeId, ingredientIndex: number, name: string): string {
  const returnUrl = new URL(`${location.pathname}${catalogueReturnHref(id, ingredientIndex, name)}`, location.origin).href
  return `${catalogueUrl()}#/items?${new URLSearchParams({ add: name, return: returnUrl })}`
}

/** The screen a URL hash names; any hash that names none is the Home screen. */
export function parseRoute(hash: string): Route {
  const [root, id, action, position, encodedName, ...rest] = hash.replace(/^#\/?/, '').split('/')
  if (root !== 'recipes' || !id) return { screen: 'home' }
  if (action === 'ingredients') {
    const ingredientIndex = Number(position)
    if (!/^\d+$/.test(position ?? '') || !encodedName || rest.length > 0 || !Number.isSafeInteger(ingredientIndex)) return { screen: 'home' }
    const recipeId = decodeId(id)
    const name = decodeText(encodedName)
    return recipeId === undefined || name === undefined ? { screen: 'home' } : { screen: 'catalogue-return', id: recipeId, ingredientIndex, name }
  }
  if (position !== undefined) return { screen: 'home' }
  if (action === undefined && id === 'new') return { screen: 'new-recipe' }
  if (action !== undefined && action !== 'edit') return { screen: 'home' }
  const recipeId = decodeId(id)
  if (recipeId === undefined) return { screen: 'home' }
  return { screen: action === undefined ? 'recipe' : 'edit-recipe', id: recipeId }
}

function decodeText(encoded: string): string | undefined {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return undefined
  }
}

function decodeId(encoded: string): RecipeId | undefined {
  const text = decodeText(encoded)
  if (text === undefined) return undefined
  try {
    return recipes.recipeId(text)
  } catch {
    return undefined
  }
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

/**
 * What `navigate` stores in a history entry: the hash of the screen it was left from, for `returnTo`, and,
 * on an entry a leave guard pushed, that guard's token.
 */
type RouteHistoryState = { readonly from?: string; readonly leaveGuard?: number }

/** Whether the app has routed since it opened, so the previous history entry is one of its own screens. */
let routed = false
/** Set while `navigateInPlace` raises its event: replacing an entry adds no earlier screen to go back to. */
let inPlace = false
addEventListener('hashchange', () => {
  if (!inPlace) routed = true
})

/** Whether Back would return to an earlier screen of this app, rather than leave it (a deep link, a shared URL, a fresh launch). */
export const canGoBack = () => routed

/** Tells the router the route changed: history calls such as pushState raise no hashchange of their own, and it follows that event. */
function announceRouteChange(addedEntry: boolean): void {
  inPlace = !addedEntry
  try {
    dispatchEvent(new HashChangeEvent('hashchange'))
  } finally {
    inPlace = false
  }
}

/** The leave guard in force, if any; see `guardLeaving`. Its token marks its history entry, which a reload keeps but a later guard must not mistake for its own. */
let guard: { readonly token: number; readonly onPopped: () => void } | null = null
let lastToken = 0

const isGuardEntry = () => guard !== null && (history.state as RouteHistoryState | null)?.leaveGuard === guard.token

const onGuardPop = () => {
  const armed = guard
  if (armed === null || isGuardEntry()) return
  guard = null
  removeEventListener('popstate', onGuardPop)
  armed.onPopped()
}

/**
 * Catches the browser's Back from the current screen: pushes a history entry on the same URL, so Back lands
 * on this screen again rather than leaving it, and then calls `onPopped`; the guard is spent by then, so call
 * `guardLeaving` again, from `onPopped` or later, to keep catching Back. Does nothing while a guard is already in force.
 * The navigation functions below, and `dropGuard`, take the guard's entry off before they go anywhere.
 */
export function guardLeaving(onPopped: () => void): void {
  if (guard !== null) return
  guard = { token: ++lastToken, onPopped }
  const state: RouteHistoryState = { ...(history.state as RouteHistoryState | null), leaveGuard: guard.token }
  history.pushState(state, '')
  addEventListener('popstate', onGuardPop)
}

/** Goes back one history entry and runs `then` when that traversal lands; a popstate while `stillHere` holds is an earlier traversal landing, not this one. */
function backThen(stillHere: () => boolean, then: () => void): void {
  const landed = () => {
    if (stillHere()) return
    removeEventListener('popstate', landed)
    then()
  }
  addEventListener('popstate', landed)
  history.back()
}

/** Takes the guard off, popping its history entry if Back has not, then runs `then`; runs it at once when there is no guard. */
export function dropGuard(then: () => void = () => {}): void {
  if (guard === null) return then()
  const { token } = guard
  const onEntry = isGuardEntry()
  guard = null
  removeEventListener('popstate', onGuardPop)
  if (!onEntry) return then()
  backThen(() => (history.state as RouteHistoryState | null)?.leaveGuard === token, then)
}

/**
 * Leaves the current screen for `href`: returns to the history entry before it when `navigate` recorded
 * that entry as `href`, so the screen left and the one returned to do not both stay in history; otherwise
 * replaces the current entry.
 */
export function returnTo(href: string): void {
  dropGuard(() => {
    if ((history.state as RouteHistoryState | null)?.from === href) history.back()
    else navigateInPlace(href)
  })
}

/** Goes to `href`, adding a history entry that remembers the screen it was left from, for `returnTo`. */
export function navigate(href: string): void {
  dropGuard(() => {
    const state: RouteHistoryState = { from: location.hash }
    history.pushState(state, '', href)
    announceRouteChange(true)
  })
}

/** Goes to `href` in place of the current history entry, so Back skips the screen being left. */
export function navigateInPlace(href: string): void {
  dropGuard(() => {
    history.replaceState(history.state, '', href)
    announceRouteChange(false)
  })
}

/**
 * Goes to `href` in place of the current history entry and, when the entry before it is `previous`, in place of that
 * one too, so Back from `href` reaches neither screen.
 */
export function replaceRoutes(href: string, previous: string): void {
  dropGuard(() => {
    if ((history.state as RouteHistoryState | null)?.from !== previous) return navigateInPlace(href)
    const leaving = location.hash
    backThen(() => location.hash === leaving, () => navigateInPlace(href))
  })
}
