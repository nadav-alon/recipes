import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { HOME_HREF } from '../routes.ts'
import { fakeItemsPort } from '../items/fake-items-port.ts'
import { fakeRecipeStore } from '../recipes/fake-recipe-store.ts'
import { RecipeEditor } from './RecipeEditor.tsx'

// Its own file: whether the app has routed since it opened is module state, and a deep link is a launch where it has not; each test here would spend that.
describe('RecipeEditor opened by a deep link', () => {
  const openDirty = () => {
    history.replaceState(null, '', '#/recipes/new') // raises no hashchange, so the app has not routed
    render(<RecipeEditor store={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Waffles' } })
  }
  const discard = () =>
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard' }))

  it("Discard after the browser's Back goes to the fallback too", async () => {
    openDirty()
    history.back()
    await waitFor(() => expect(document.querySelector('dialog')).toHaveAttribute('open'))
    discard()
    await waitFor(() => expect(location.hash).toBe(HOME_HREF))
  })
})
