import { describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { fakeItemsPort } from './fake-items-port.ts'
import type { WatchedItem } from './items-port.ts'

const flour: WatchedItem = { id: core.itemId('flour'), name: 'Flour', state: 'enough', deleted: false }
const salt: WatchedItem = { id: core.itemId('salt'), name: 'Salt', state: 'out', deleted: true }

function watched(port: ReturnType<typeof fakeItemsPort>) {
  const seen: Array<readonly WatchedItem[]> = []
  const stop = port.watchItems((items) => seen.push(items), () => {})
  return { seen, stop }
}

describe('fakeItemsPort', () => {
  it('delivers its Items, soft-deleted ones marked, and nothing once the watch is stopped', async () => {
    const port = fakeItemsPort([flour, salt])
    const { seen, stop } = watched(port)
    expect(seen).toEqual([[flour, salt]])

    stop()
    await port.setItemState(flour.id, 'out')
    expect(seen).toHaveLength(1)
  })

  it('sets a State, delivers the change and appends to the State history', async () => {
    const port = fakeItemsPort([flour])
    const { seen } = watched(port)

    await port.setItemState(flour.id, 'out')

    expect(seen.at(-1)).toEqual([{ ...flour, state: 'out' }])
    expect(port.stateHistory(flour.id)).toEqual(['out'])
  })

  it('writes nothing when the State is the one the Item already has', async () => {
    const port = fakeItemsPort([flour])
    const { seen } = watched(port)

    await port.setItemState(flour.id, 'enough')

    expect(seen).toHaveLength(1)
    expect(port.stateHistory(flour.id)).toEqual([])
  })

  it('reports a failed watch to onError and stops calling the watcher', async () => {
    const port = fakeItemsPort([flour])
    const seen: Array<readonly WatchedItem[]> = []
    const errors: unknown[] = []
    port.watchItems((items) => seen.push(items), (error) => errors.push(error))
    const error = new Error('permission-denied')

    port.failWatches(error)
    await port.setItemState(flour.id, 'out')

    expect(errors).toEqual([error])
    expect(seen).toHaveLength(1)
  })

  it('rejects an Item it does not have', async () => {
    const port = fakeItemsPort([])

    await expect(port.setItemState(flour.id, 'out')).rejects.toThrow(/flour/)
  })
})
