import type { core } from 'data-platform'

/** An Item as the Catalogue holds it; `deleted` marks one the Catalogue has soft-deleted. */
export interface WatchedItem {
  readonly id: core.ItemId
  readonly name: string
  readonly state: core.State
  readonly deleted: boolean
}

export type Unsubscribe = () => void

/**
 * Recipes' only door to the Catalogue's Items. It reads Items and writes an Item's State; it never
 * creates, renames or deletes an Item.
 */
export interface ItemsPort {
  /**
   * Calls `onItems` with every Item, live and soft-deleted, now and on each change. An empty list
   * means the Catalogue has no Items. A failed watch calls `onError` and ends it.
   */
  watchItems(onItems: (items: readonly WatchedItem[]) => void, onError: (error: unknown) => void): Unsubscribe

  /**
   * Sets an Item's State and appends a State history entry stamped with the server time, in one
   * batch; setting the State the Item already has writes nothing. Rejects if the Item does not
   * exist or the write is refused.
   */
  setItemState(id: core.ItemId, state: core.State): Promise<void>
}
