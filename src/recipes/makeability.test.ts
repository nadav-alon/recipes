import { describe, expect, it } from 'vitest'
import type { core, recipes } from 'data-platform'
import { classifyIngredient, type ItemsById } from './makeability.ts'

const id = (value: string) => value as core.ItemId

function ingredient(fields: Partial<recipes.Ingredient> = {}): recipes.Ingredient {
  return { name: 'thing', ...fields }
}

const items: ItemsById = new Map([
  ['flour', { state: 'enough' }],
  ['milk', { state: 'running low' }],
  ['eggs', { state: 'out' }],
  ['out-and-gone', { state: 'out', deletedAt: { seconds: 1, nanoseconds: 0 } }],
  ['gone', { state: 'enough', deletedAt: { seconds: 1, nanoseconds: 0 } }],
])

describe('classifyIngredient', () => {
  it('is at home for an Item that is enough', () => {
    expect(classifyIngredient(ingredient({ itemId: id('flour') }), items)).toEqual({ kind: 'at home' })
  })

  it('is at home and running low for an Item that is running low', () => {
    expect(classifyIngredient(ingredient({ itemId: id('milk') }), items)).toEqual({
      kind: 'at home',
      runningLow: true,
    })
  })

  it('is Assumed for a marked Ingredient', () => {
    expect(classifyIngredient(ingredient({ assumed: true }), items)).toEqual({ kind: 'assumed' })
  })

  it('is Missing as Unlinked with no Item and not Assumed', () => {
    expect(classifyIngredient(ingredient(), items)).toEqual({ kind: 'missing', reason: 'unlinked' })
  })

  it('is Missing when the Item is out', () => {
    expect(classifyIngredient(ingredient({ itemId: id('eggs') }), items)).toEqual({
      kind: 'missing',
      reason: 'item out',
    })
  })

  it('is Missing as soft-deleted when the Item is soft-deleted, whatever its State', () => {
    for (const itemId of ['gone', 'out-and-gone']) {
      expect(classifyIngredient(ingredient({ itemId: id(itemId) }), items)).toEqual({
        kind: 'missing',
        reason: 'item soft-deleted',
      })
    }
  })

  it('is Missing as soft-deleted when the linked id is absent from the Items', () => {
    expect(classifyIngredient(ingredient({ itemId: id('nowhere') }), items)).toEqual({
      kind: 'missing',
      reason: 'item soft-deleted',
    })
  })
})
