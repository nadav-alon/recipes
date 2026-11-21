import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recipes } from 'data-platform'
import { App } from './App.tsx'
import { fakeItemsPort } from './items/fake-items-port.ts'
import { fakeRecipeStore } from './recipes/fake-recipe-store.ts'
import { editRecipeHref, HOME_HREF, NEW_RECIPE_HREF, recipeHref } from './routes.ts'

const r1 = recipes.recipeId('r1')
const r2 = recipes.recipeId('r2')
const store = () =>
  fakeRecipeStore([
    { id: r1, recipe: { title: 'Omelette', ingredients: [], prepSteps: [], steps: ['Whisk'] } },
    { id: r2, recipe: { title: 'Pancakes', ingredients: [], prepSteps: [], steps: ['Flip'] } },
  ])

afterEach(() => {
  location.hash = ''
})

describe('App', () => {
  it('opens on the home screen', () => {
    render(<App recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'Makeable' })).toBeInTheDocument()
  })

  it('opens a Recipe directly from its URL, with an Edit link to its editor', () => {
    location.hash = recipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', editRecipeHref(r1))
  })

  it('opens a Recipe from its link on Home, then its editor from the Edit link', async () => {
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    fireEvent.click(await screen.findByRole('link', { name: 'Omelette' }))
    expect(await screen.findByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Edit' }))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Omelette'))
  })

  it('opens the empty editor from the New Recipe link on Home', async () => {
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    fireEvent.click(await screen.findByRole('link', { name: 'New Recipe' }))
    expect(await screen.findByRole('heading', { name: 'New Recipe' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('')
  })

  it('follows the URL as it changes, from Home to a Recipe', async () => {
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    await act(() => {
      location.hash = recipeHref(r1)
      fireEvent(window, new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
  })

  it('edits the Recipe the URL names when it moves from one Recipe\'s editor to another\'s', async () => {
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByLabelText('Title')).toHaveValue('Omelette')
    await act(() => {
      location.hash = editRecipeHref(r2)
      fireEvent(window, new HashChangeEvent('hashchange'))
    })
    expect(screen.getByLabelText('Title')).toHaveValue('Pancakes')
  })

  it('says so when the Recipe at the URL does not exist', () => {
    location.hash = recipeHref(recipes.recipeId('nope'))
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This Recipe does not exist.')
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: 'Back' }))
  })

  it('keeps the top app bar, with Back, when the Recipes cannot be loaded', () => {
    location.hash = recipeHref(r1)
    const failing = { ...store(), watch: (_onChange: unknown, onError?: (e: Error) => void) => (onError?.(new Error('permission-denied')), () => {}) }
    render(<App recipeStore={failing as never} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The Recipe could not be loaded.')
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: 'Back' }))
  })

  it('opens the editor empty at the new-Recipe URL, and shows the Recipe once it is saved', async () => {
    location.hash = NEW_RECIPE_HREF
    render(<App recipeStore={fakeRecipeStore()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument()
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(location.hash).toMatch(/^#\/recipes\/fake-/))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeInTheDocument()
  })

  it('returns to the new Recipe\'s view while the server has not acknowledged its write', async () => {
    const inner = fakeRecipeStore()
    // Like the real store offline: the id comes back once the write is issued; the server's
    // acknowledgement never arrives.
    const offline = {
      ...inner,
      async create(recipe: Parameters<typeof inner.create>[0]) {
        const id = await inner.create(recipe)
        void new Promise<void>(() => {})
        return id
      },
    }
    location.hash = NEW_RECIPE_HREF
    render(<App recipeStore={offline} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(location.hash).toMatch(/^#\/recipes\/fake-/))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Pancakes' })).toBeInTheDocument()
  })

  it('reports a refused create on the view it navigated to, with a way back to the editor holding the new Recipe', async () => {
    const refusing = fakeRecipeStore()
    refusing.refuseCreates(new Error('Permission denied'))
    location.hash = NEW_RECIPE_HREF
    render(<App recipeStore={refusing} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(location.hash).toMatch(/^#\/recipes\/fake-/))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByText('Your new Recipe Pancakes was not saved: Permission denied')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Back to the editor' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Pancakes'))
    expect(screen.getByRole('heading', { name: 'New Recipe' })).toBeInTheDocument()
  })

  it('reports a refused create that arrives while another new Recipe is being written, keeping that form and offering the refused one', async () => {
    vi.useFakeTimers()
    try {
      const refusing = fakeRecipeStore()
      refusing.refuseCreates(new Error('Permission denied'))
      location.hash = NEW_RECIPE_HREF
      render(<App recipeStore={refusing} itemsPort={fakeItemsPort([])} />)
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      })
      expect(location.hash).toMatch(/^#\/recipes\/fake-/)
      await act(() => {
        location.hash = NEW_RECIPE_HREF
        fireEvent(window, new HashChangeEvent('hashchange'))
      })
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Waffles' } })

      await act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(screen.getByText('Your new Recipe Pancakes was not saved: Permission denied')).toBeInTheDocument()
      expect(screen.getByLabelText('Title')).toHaveValue('Waffles')
      await act(() => {
        fireEvent.click(screen.getByRole('link', { name: 'Back to the editor' }))
      })
      expect(screen.getByLabelText('Title')).toHaveValue('Pancakes')
      expect(screen.queryByText(/was not saved/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps every refused save listed, each with its own Back to the editor and Dismiss', async () => {
    const rejecting = { ...store(), update: () => Promise.reject(new Error('Permission denied')) }
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={rejecting} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    await screen.findByText('Your edit to Frittata was not saved: Permission denied')
    location.hash = editRecipeHref(r2)
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Pancakes'))
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Crepes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    await screen.findByText('Your edit to Crepes was not saved: Permission denied')
    expect(screen.getByText('Your edit to Frittata was not saved: Permission denied')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Back to the editor' })).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]!)
    expect(screen.queryByText(/Frittata was not saved/)).not.toBeInTheDocument()
    expect(screen.getByText('Your edit to Crepes was not saved: Permission denied')).toBeInTheDocument()
  })

  async function refuseTwoCreates() {
    const refusing = fakeRecipeStore()
    refusing.refuseCreates(new Error('Permission denied'))
    // The previous test's hash reset fires its hashchange after a tick.
    await new Promise((resolve) => setTimeout(resolve, 0))
    render(<App recipeStore={refusing} itemsPort={fakeItemsPort([])} />)
    for (const title of ['Pancakes', 'Waffles']) {
      location.hash = NEW_RECIPE_HREF
      fireEvent(window, new HashChangeEvent('hashchange'))
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: title } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(location.hash).toMatch(/^#\/recipes\/fake-/))
      fireEvent(window, new HashChangeEvent('hashchange'))
      await screen.findByText(`Your new Recipe ${title} was not saved: Permission denied`)
    }
  }

  it('restores one of several refused creates, leaving the others listed', async () => {
    await refuseTwoCreates()
    fireEvent.click(screen.getAllByRole('link', { name: 'Back to the editor' })[1]!)
    location.hash = NEW_RECIPE_HREF
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Waffles'))
    expect(screen.getByText('Your new Recipe Pancakes was not saved: Permission denied')).toBeInTheDocument()
    expect(screen.queryByText(/Waffles was not saved/)).not.toBeInTheDocument()
  })

  it('does not reopen a held create on the next visit after a modified click on its link', async () => {
    await refuseTwoCreates()
    fireEvent.click(screen.getAllByRole('link', { name: 'Back to the editor' })[1]!, { ctrlKey: true })
    location.hash = NEW_RECIPE_HREF
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.getByLabelText('Title')).toHaveValue('')
  })

  it('keeps both refused edits of one Recipe listed when two saves are in flight, and reopens the editor on the latest', async () => {
    const refusals: Array<(error: Error) => void> = []
    const pending = {
      ...store(),
      update: () => new Promise<void>((_, reject) => refusals.push(reject)),
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    render(<App recipeStore={pending} itemsPort={fakeItemsPort([])} />)
    for (const title of ['Frittata', 'Quiche']) {
      location.hash = editRecipeHref(r1)
      fireEvent(window, new HashChangeEvent('hashchange'))
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: title } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      fireEvent(window, new HashChangeEvent('hashchange'))
    }
    await act(() => {
      for (const refuse of refusals) refuse(new Error('Permission denied'))
    })
    await screen.findByText('Your edit to Quiche was not saved: Permission denied')
    expect(screen.getByText('Your edit to Frittata was not saved: Permission denied')).toBeInTheDocument()
    location.hash = editRecipeHref(r1)
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Quiche'))
    expect(screen.getByText('Your edit to Frittata was not saved: Permission denied')).toBeInTheDocument()
    expect(screen.queryByText(/Quiche was not saved/)).not.toBeInTheDocument()
  })

  it('keeps a refused create listed when a later edit is refused', async () => {
    const refusing = fakeRecipeStore([
      { id: r1, recipe: { title: 'Omelette', ingredients: [], prepSteps: [], steps: ['Whisk'] } },
    ])
    refusing.refuseCreates(new Error('Permission denied'))
    const rejecting = { ...refusing, update: () => Promise.reject(new Error('Offline')) }
    vi.useFakeTimers()
    try {
      location.hash = NEW_RECIPE_HREF
      render(<App recipeStore={rejecting} itemsPort={fakeItemsPort([])} />)
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Pancakes' } })
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      })
      await act(() => {
        location.hash = editRecipeHref(r1)
        fireEvent(window, new HashChangeEvent('hashchange'))
      })
      fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      })
      await act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByText('Your new Recipe Pancakes was not saved: Permission denied')).toBeInTheDocument()
      expect(screen.getByText('Your edit to Frittata was not saved: Offline')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens the editor on the Recipe at its edit URL, and saving returns to its view', async () => {
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
    expect(screen.getByLabelText('Title')).toHaveValue('Omelette')
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(location.hash).toBe(recipeHref(r1))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Frittata' })).toBeInTheDocument()
  })

  it('reports a rejected edit on the view it navigated to, with a way back to the editor holding the edit', async () => {
    const rejecting = { ...store(), update: () => Promise.reject(new Error('Permission denied')) }
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={rejecting} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(location.hash).toBe(recipeHref(r1))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edit to Frittata was not saved: Permission denied')
    expect(await screen.findByRole('heading', { name: 'Omelette' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Back to the editor' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Frittata'))
  })

  it('keeps a rejected edit of one Recipe when another Recipe is saved', async () => {
    const rejectingFirst = {
      ...store(),
      update: (id: typeof r1) => (id === r1 ? Promise.reject(new Error('Permission denied')) : Promise.resolve()),
    }
    location.hash = editRecipeHref(r1)
    render(<App recipeStore={rejectingFirst} itemsPort={fakeItemsPort([])} />)
    fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Frittata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edit to Frittata was not saved')
    location.hash = editRecipeHref(r2)
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Pancakes'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edit to Frittata was not saved')
  })

  it('returns to Home once the Undo offer for a deleted Recipe ends', async () => {
    vi.useFakeTimers()
    try {
      location.hash = editRecipeHref(r1)
      render(<App recipeStore={store()} itemsPort={fakeItemsPort([])} />)
      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete Recipe' }))
      })
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(location.hash).toBe(editRecipeHref(r1))
      await act(() => {
        vi.advanceTimersByTime(9000)
      })
      expect(location.hash).toBe(HOME_HREF)
    } finally {
      vi.useRealTimers()
    }
  })
})
