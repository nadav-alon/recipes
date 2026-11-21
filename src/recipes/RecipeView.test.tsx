import { act, cleanup, render, screen, within } from '@testing-library/preact'
import { fireEvent } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import type { core, recipes } from 'data-platform'
import { fakeItemsPort, type FakeItemsPort } from '../items/fake-items-port.ts'
import type { WatchedItem } from '../items/items-port.ts'
import { RecipeView } from './RecipeView.tsx'
import type { ItemsById } from './makeability.ts'

const id = (value: string) => value as core.ItemId

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
  return screen.getByRole('listitem', { name })
}

describe('RecipeView ingredients', () => {
  it('shows each Ingredient with its quantity, unit and prep note', () => {
    render(
      <RecipeView
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

  it('flags an Unlinked Ingredient as Missing and unlinked', () => {
    render(<RecipeView recipe={recipe({ ingredients: [{ name: 'Salt' }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(line('Salt')).toHaveTextContent('Missing: not linked to an Item')
  })

  it('flags an Ingredient whose Item is out as Missing', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Eggs', itemId: id('eggs') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Eggs')).toHaveTextContent('Missing: out')
  })

  it('flags an Ingredient whose Item the Catalogue deleted as Missing', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Old', itemId: id('gone') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Old')).toHaveTextContent('Missing: deleted in the Catalogue')
  })

  it('flags an Ingredient whose Item is running low', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Milk', itemId: id('milk') }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Milk')).toHaveTextContent('Running low')
    expect(line('Milk')).not.toHaveTextContent('Missing')
  })

  it('flags an Assumed Ingredient', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Water', assumed: true }] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />,
    )
    expect(line('Water')).toHaveTextContent('Assumed')
  })
})

describe('RecipeView sections', () => {
  it('shows Prep Steps as their own section before the Steps', () => {
    render(
      <RecipeView
        recipe={recipe({ prepSteps: ['Sift the flour'], steps: ['Whisk', 'Fry'] })}
        items={items}
        itemsPort={fakeItemsPort([])}
        editHref="#/edit"
      />,
    )
    const prep = screen.getByRole('heading', { name: 'Prep Steps' })
    const steps = screen.getByRole('heading', { name: 'Steps' })
    expect(prep.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Sift the flour')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((el) => el.textContent)).toEqual(['Sift the flour', 'Whisk', 'Fry'])
  })

  it('leaves out the Prep Steps section when there are none', () => {
    render(<RecipeView recipe={recipe({ steps: ['Fry'] })} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByRole('heading', { name: 'Prep Steps' })).toBeNull()
  })

  it('shows Servings, the source link and notes when present', () => {
    render(
      <RecipeView
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
    render(<RecipeView recipe={recipe()} items={items} itemsPort={fakeItemsPort([])} editHref="#/edit" />)
    expect(screen.queryByText(/Servings/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Source' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull()
  })

  it('links to the editor', () => {
    render(<RecipeView recipe={recipe()} items={items} itemsPort={fakeItemsPort([])} editHref="#/recipes/r1/edit" />)
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '#/recipes/r1/edit')
  })
})

describe('RecipeView actually out', () => {
  const watched = (state: core.State, itemId = 'flour'): WatchedItem => ({
    id: id(itemId),
    name: itemId,
    state,
    deleted: false,
  })

  function renderWith(port: FakeItemsPort, ingredient: recipes.Ingredient) {
    let current: ItemsById = new Map()
    port.watchItems(
      (list) => {
        current = new Map(list.map((item) => [item.id, { state: item.state }]))
      },
      () => {},
    )
    return render(
      <RecipeView recipe={recipe({ ingredients: [ingredient] })} items={current} itemsPort={port} editHref="#/edit" />,
    )
  }

  it('offers "actually out" on a Linked Ingredient whose Item is not out, and sets it out', async () => {
    const port = fakeItemsPort([watched('enough')])
    renderWith(port, { name: 'Flour', itemId: id('flour') })
    await click(within(line('Flour')).getByRole('button', { name: 'Actually out' }))
    expect(port.stateHistory(id('flour'))).toEqual(['out'])
  })

  it('offers it on a running low Item too', () => {
    renderWith(fakeItemsPort([watched('running low')]), { name: 'Flour', itemId: id('flour') })
    expect(within(line('Flour')).getByRole('button', { name: 'Actually out' })).toBeInTheDocument()
  })

  it('does not offer it when the Item is already out', () => {
    renderWith(fakeItemsPort([watched('out')]), { name: 'Flour', itemId: id('flour') })
    expect(screen.queryByRole('button', { name: 'Actually out' })).toBeNull()
  })

  it('does not offer it on an Unlinked or Assumed Ingredient', () => {
    renderWith(fakeItemsPort([]), { name: 'Salt' })
    expect(screen.queryByRole('button', { name: 'Actually out' })).toBeNull()
    cleanup()
    renderWith(fakeItemsPort([]), { name: 'Water', assumed: true })
    expect(screen.queryByRole('button', { name: 'Actually out' })).toBeNull()
  })

  it('restores the previous State on Undo', async () => {
    const port = fakeItemsPort([watched('running low')])
    renderWith(port, { name: 'Flour', itemId: id('flour') })
    await click(screen.getByRole('button', { name: 'Actually out' }))
    await click(screen.getByRole('button', { name: 'Undo' }))
    expect(port.stateHistory(id('flour'))).toEqual(['out', 'running low'])
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('reports a refused write', async () => {
    const port = fakeItemsPort([watched('enough')])
    port.setItemState = () => Promise.reject(new Error('denied'))
    renderWith(port, { name: 'Flour', itemId: id('flour') })
    await click(screen.getByRole('button', { name: 'Actually out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('denied')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element)
  })
}
