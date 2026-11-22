import { act, render, screen, within } from '@testing-library/preact'
import { fireEvent } from '@testing-library/preact'
import { useEffect, useState } from 'preact/hooks'
import { afterEach, describe, expect, it } from 'vitest'
import { resetSnackbar, SnackbarHost } from 'household-ui/ui/Snackbar.tsx'
import { recipes, type core } from 'data-platform'
import { fakeItemsPort, type FakeItemsPort } from '../items/fake-items-port.ts'
import type { WatchedItem } from '../items/items-port.ts'
import { addToCatalogueHref } from '../routes.ts'
import { RecipeView } from './RecipeView.tsx'
import type { ItemsById } from './makeability.ts'

const id = (value: string) => value as core.ItemId
const rid = recipes.recipeId('r1')

const items: ItemsById = new Map([
  [id('flour'), { state: 'enough' }],
  [id('milk'), { state: 'running low' }],
  [id('eggs'), { state: 'out' }],
  [id('gone'), { state: 'enough', deletedAt: { seconds: 1, nanoseconds: 0 } }],
])

function recipe(fields: Partial<recipes.Recipe> = {}): recipes.Recipe {
  return { title: 'Pancakes', ingredients: [], prepSteps: [], steps: [], ...fields }
}

function line(name: string): HTMLElement {
  return screen.getByText(name, { selector: '.ui-list-row__headline' }).closest('li')!
}

function expectBefore(first: HTMLElement, second: HTMLElement): void {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

describe('RecipeView ingredients', () => {
  it('shows each Ingredient with its quantity, unit and prep note', () => {
    render(
      <RecipeView
        recipeId={rid}
        recipe={recipe({
          ingredients: [{ name: 'Flour', itemId: id('flour'), quantity: 200, unit: 'g', prepNote: 'sifted' }],
        })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    expect(line('Flour')).toHaveTextContent('200 g')
    expect(line('Flour')).toHaveTextContent('sifted')
    expect(within(line('Flour')).queryByText(/missing|running low|assumed/i)).toBeNull()
  })

  it.each([
    [3, 'piece', '3 pieces'],
    [2, 'cup', '2 cups'],
    [0.5, 'cup', '0.5 cups'],
    [1, 'piece', '1 piece'],
    [1, 'cup', '1 cup'],
    [500, 'g', '500 g'],
    [2, 'tbsp', '2 tbsp'],
    [2, 'ml', '2 ml'],
    [0, 'cup', '0 cups'],
  ] as const)('writes %s %s as "%s"', (quantity, unit, text) => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Thing', quantity, unit }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Thing')).toHaveTextContent(new RegExp(`${text}\\b`))
  })

  it('writes an amount with no unit as the quantity alone', () => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Thing', quantity: 3 }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Thing')).toHaveTextContent('3')
    expect(line('Thing')).not.toHaveTextContent(/\b3 \w/)
  })

  it('flags an Unlinked Ingredient as Missing', () => {
    render(<RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Salt' }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(line('Salt')).toHaveTextContent('Missing: Unlinked')
  })

  it('flags an Ingredient whose Item is out as Missing', () => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Eggs', itemId: id('eggs') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Eggs')).toHaveTextContent('Missing: out')
  })

  it('flags an Ingredient whose Item the Catalogue deleted as Missing', () => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Old', itemId: id('gone') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Old')).toHaveTextContent('Missing: deleted in the Catalogue')
  })

  it('flags an Ingredient whose Item is running low', () => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Milk', itemId: id('milk') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Milk')).toHaveTextContent('Running low')
    expect(line('Milk')).not.toHaveTextContent('Missing')
  })

  it('flags an Assumed Ingredient', () => {
    render(
      <RecipeView recipeId={rid} recipe={recipe({ ingredients: [{ name: 'Water', assumed: true }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Water')).toHaveTextContent('Assumed')
  })
})

describe('RecipeView sections', () => {
  it('shows Prep Steps as their own section before the Steps', () => {
    render(
      <RecipeView
        recipeId={rid}
        recipe={recipe({ prepSteps: ['Sift the flour'], steps: ['Whisk', 'Fry'] })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    const prep = screen.getByRole('heading', { name: 'Prep Steps' })
    const steps = screen.getByRole('heading', { name: 'Steps' })
    expectBefore(prep, steps)
    expect(screen.getByText('Sift the flour')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((el) => el.textContent)).toEqual(['Sift the flour', 'Whisk', 'Fry'])
  })

  it('heads the Ingredients above the list, before the Prep Steps', () => {
    render(
      <RecipeView
        recipeId={rid}
        recipe={recipe({ ingredients: [{ name: 'Flour', itemId: id('flour') }], prepSteps: ['Sift'], steps: ['Fry'] })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    const heading = screen.getByRole('heading', { name: 'Ingredients' })
    expect(heading.tagName).toBe('H2')
    expectBefore(heading, line('Flour'))
    expectBefore(heading, screen.getByRole('heading', { name: 'Prep Steps' }))
  })

  it('leaves out the Ingredients section when there are none', () => {
    render(<RecipeView recipeId={rid} recipe={recipe({ steps: ['Fry'] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByRole('heading', { name: 'Ingredients' })).toBeNull()
  })

  it('leaves out the Steps section when there are none', () => {
    render(<RecipeView recipeId={rid} recipe={recipe({ prepSteps: ['Sift'] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByRole('heading', { name: 'Steps' })).toBeNull()
  })

  it('leaves out the Prep Steps section when there are none', () => {
    render(<RecipeView recipeId={rid} recipe={recipe({ steps: ['Fry'] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByRole('heading', { name: 'Prep Steps' })).toBeNull()
  })

  it('shows Servings, the source link and notes when present', () => {
    render(
      <RecipeView
        recipeId={rid}
        recipe={recipe({ servings: 4, sourceUrl: 'https://example.com/p', notes: 'Rest the batter' })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    expect(screen.getByText(/Servings: 4/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://example.com/p')
    expect(screen.getByText('Rest the batter')).toBeInTheDocument()
  })

  it('leaves out Servings, the source link and notes when absent', () => {
    render(<RecipeView recipeId={rid} recipe={recipe()} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByText(/Servings/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Source' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull()
  })

  it('opens the editor from an Edit button in the top app bar', () => {
    render(<RecipeView recipeId={rid} recipe={recipe()} items={items} itemsPort={fakeItemsPort([])} editHref="#/recipes/r1/edit" />)
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Edit' }))
    expect(location.hash).toBe('#/recipes/r1/edit')
  })
})

describe('RecipeView actually out', () => {
  afterEach(resetSnackbar)

  const watched = (state: core.State, itemId = 'flour', deleted = false): WatchedItem => ({
    id: id(itemId),
    name: itemId,
    state,
    deleted,
  })

  /** Renders the view over the port's live Items, so it re-renders when a State changes. */
  function Live({ port, ingredients }: { port: FakeItemsPort; ingredients: recipes.Ingredient[] }) {
    const [current, setCurrent] = useState<ItemsById>(new Map())
    useEffect(
      () =>
        port.watchItems(
          (list) =>
            setCurrent(
              new Map(list.map((item) => [item.id, { state: item.state, ...(item.deleted ? { deletedAt: { seconds: 1, nanoseconds: 0 } } : {}) }])),
            ),
          () => {},
        ),
      [port],
    )
    return <RecipeView recipeId={rid} recipe={recipe({ ingredients })} items={current} itemsPort={port} editHref="#/edit" />
  }

  const renderWith = (port: FakeItemsPort, ...ingredients: recipes.Ingredient[]) =>
    render(
      <>
        <Live port={port} ingredients={ingredients} />
        <SnackbarHost />
      </>,
    )

  const flour: recipes.Ingredient = { name: 'Flour', itemId: id('flour') }
  const actuallyOut = (name = 'Flour') => within(line(name)).getByRole('button', { name: `${name} is actually out` })

  const noActuallyOut = (scope: Pick<typeof screen, 'queryByRole'> = screen) => scope.queryByRole('button', { name: /is actually out/ })

  it('names the Ingredient in the button without surrounding whitespace', () => {
    renderWith(fakeItemsPort([watched('enough')]), { name: ' Flour ', itemId: id('flour') })
    expect(screen.getByRole('button', { name: 'Flour is actually out' })).toBeInTheDocument()
  })

  it('offers "actually out" on a Linked Ingredient whose Item is not out, and sets it out', async () => {
    const port = fakeItemsPort([watched('enough')])
    renderWith(port, flour)
    await click(actuallyOut())
    expect(port.stateHistory(id('flour'))).toEqual(['out'])
  })

  it('flags the Ingredient Missing and drops the button once the Item is out', async () => {
    renderWith(fakeItemsPort([watched('enough')]), flour)
    await click(actuallyOut())
    expect(line('Flour')).toHaveTextContent('Missing: out')
    expect(noActuallyOut(within(line('Flour')))).toBeNull()
  })

  it('offers it on a running low Item too', () => {
    renderWith(fakeItemsPort([watched('running low')]), flour)
    expect(actuallyOut()).toBeInTheDocument()
  })

  it('does not offer it when the Item is already out', () => {
    renderWith(fakeItemsPort([watched('out')]), flour)
    expect(noActuallyOut()).toBeNull()
  })

  it('does not offer it on an Unlinked Ingredient', () => {
    renderWith(fakeItemsPort([]), { name: 'Salt' })
    expect(noActuallyOut()).toBeNull()
  })

  it('does not offer it on an Assumed Ingredient', () => {
    renderWith(fakeItemsPort([]), { name: 'Water', assumed: true })
    expect(noActuallyOut()).toBeNull()
  })

  it('does not offer it when the Item is soft-deleted', () => {
    renderWith(fakeItemsPort([watched('enough', 'flour', true)]), flour)
    expect(noActuallyOut()).toBeNull()
  })

  it('does not offer it when the Item id is not among the Items', () => {
    renderWith(fakeItemsPort([watched('enough', 'other')]), flour)
    expect(noActuallyOut()).toBeNull()
  })

  it('restores the previous State on Undo', async () => {
    const port = fakeItemsPort([watched('running low')])
    renderWith(port, flour)
    await click(actuallyOut())
    expect(screen.getByRole('status')).toHaveTextContent(/^Flour marked as out(Undo)?$/)
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(port.stateHistory(id('flour'))).toEqual(['out', 'running low'])
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull()
  })

  it('offers Undo for the latest Item marked out, as the snackbar shows one message at a time', async () => {
    const port = fakeItemsPort([watched('enough'), watched('running low', 'milk')])
    renderWith(port, flour, { name: 'Milk', itemId: id('milk') })
    await click(actuallyOut('Flour'))
    await click(actuallyOut('Milk'))
    expect(screen.getByRole('status')).toHaveTextContent(/^Milk marked as out(Undo)?$/)
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(port.stateHistory(id('milk'))).toEqual(['out', 'running low'])
    expect(port.stateHistory(id('flour'))).toEqual(['out'])
  })

  it('leaves a newer State alone when Undo is pressed after the Item is no longer out', async () => {
    const port = fakeItemsPort([watched('enough')])
    renderWith(port, flour)
    await click(actuallyOut())
    await act(async () => {
      await port.setItemState(id('flour'), 'enough')
    })
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(port.stateHistory(id('flour'))).toEqual(['out', 'enough'])
  })

  it('leaves a newer State alone when Undo is pressed after the view is gone', async () => {
    const port = fakeItemsPort([watched('enough')])
    const view = render(<Live port={port} ingredients={[flour]} />)
    render(<SnackbarHost />)
    await click(actuallyOut())
    view.unmount()
    await act(async () => {
      await port.setItemState(id('flour'), 'enough')
    })
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(port.stateHistory(id('flour'))).toEqual(['out', 'enough'])
  })

  it('ignores a second click while the write is pending', async () => {
    const port = fakeItemsPort([watched('enough')])
    const calls: core.State[] = []
    port.setItemState = (_id, state) => {
      calls.push(state)
      return new Promise(() => {})
    }
    renderWith(port, flour)
    await click(actuallyOut())
    expect(actuallyOut()).toBeDisabled()
    await click(actuallyOut())
    expect(calls).toEqual(['out'])
  })

  it('reports a refused write', async () => {
    const port = fakeItemsPort([watched('enough')])
    port.setItemState = () => Promise.reject(new Error('denied'))
    renderWith(port, flour)
    await click(actuallyOut())
    expect(await screen.findByRole('alert')).toHaveTextContent('denied')
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull()
  })
})

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element)
  })
}

describe('RecipeView top app bar', () => {
  it('titles the bar with the Recipe and offers a back arrow', () => {
    render(<RecipeView recipeId={rid} recipe={recipe()} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByRole('heading', { name: 'Pancakes' })).toBeInTheDocument()
    expect(bar.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})

describe('RecipeView Add to Catalogue', () => {
  it('offers the Catalogue hand-off on an Unlinked Ingredient only', () => {
    render(
      <RecipeView
        recipeId={rid}
        recipe={recipe({ ingredients: [{ name: 'Flour', itemId: id('flour') }, { name: 'Salt' }, { name: 'Pepper', assumed: true }, { name: 'Eggs', itemId: id('eggs') }] })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    expect(screen.getAllByText('Add to Catalogue')).toHaveLength(1)
    const href = within(line('Salt')).getByText('Add to Catalogue').getAttribute('href')!
    expect(href).toBe(addToCatalogueHref(rid, 1, 'Salt'))
    expect(href).toMatch(/^\/home-catalogue\/#\/items\?add=Salt&return=/)
  })
})
