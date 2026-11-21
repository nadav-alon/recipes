import type { core } from 'data-platform'
import type { ItemsPort, WatchedItem } from './items-port.ts'

/** An in-memory `ItemsPort` for consumers' tests, plus what it recorded of each Item's State history. */
export interface FakeItemsPort extends ItemsPort {
  /** The States set on an Item, oldest first; empty if none was ever set. */
  stateHistory(id: core.ItemId): readonly core.State[]
}

export function fakeItemsPort(initial: readonly WatchedItem[]): FakeItemsPort {
  let items = [...initial]
  const history = new Map<core.ItemId, core.State[]>()
  const watchers = new Set<(items: readonly WatchedItem[]) => void>()

  return {
    watchItems(onItems) {
      watchers.add(onItems)
      onItems(items)
      return () => watchers.delete(onItems)
    },

    async setItemState(id, state) {
      const current = items.find((item) => item.id === id)
      if (!current) throw new Error(`No Item ${id} to set the State of`)
      if (current.state === state) return
      items = items.map((item) => (item.id === id ? { ...item, state } : item))
      history.set(id, [...(history.get(id) ?? []), state])
      watchers.forEach((notify) => notify(items))
    },

    stateHistory: (id) => history.get(id) ?? [],
  }
}
