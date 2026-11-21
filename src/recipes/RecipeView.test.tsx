import { render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import type { core, recipes } from 'data-platform'
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
        editHref="#/edit"
      />,
    )
    expect(line('Flour')).toHaveTextContent('200 g')
    expect(line('Flour')).toHaveTextContent('sifted')
    expect(within(line('Flour')).queryByText(/missing|running low|assumed/i)).toBeNull()
  })

  it('flags an Unlinked Ingredient as Missing and unlinked', () => {
    render(<RecipeView recipe={recipe({ ingredients: [{ name: 'Salt' }] })} items={items} editHref="#/edit" />)
    expect(line('Salt')).toHaveTextContent('Missing: not linked to an Item')
  })

  it('flags an Ingredient whose Item is out as Missing', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Eggs', itemId: id('eggs') }] })} items={items} editHref="#/edit" />,
    )
    expect(line('Eggs')).toHaveTextContent('Missing: out')
  })

  it('flags an Ingredient whose Item the Catalogue deleted as Missing', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Old', itemId: id('gone') }] })} items={items} editHref="#/edit" />,
    )
    expect(line('Old')).toHaveTextContent('Missing: deleted in the Catalogue')
  })

  it('flags an Ingredient whose Item is running low', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Milk', itemId: id('milk') }] })} items={items} editHref="#/edit" />,
    )
    expect(line('Milk')).toHaveTextContent('Running low')
    expect(line('Milk')).not.toHaveTextContent('Missing')
  })

  it('flags an Assumed Ingredient', () => {
    render(
      <RecipeView recipe={recipe({ ingredients: [{ name: 'Water', assumed: true }] })} items={items} editHref="#/edit" />,
    )
    expect(line('Water')).toHaveTextContent('Assumed')
  })
})
