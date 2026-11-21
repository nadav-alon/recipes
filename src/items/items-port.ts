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
   * Calls `onItems` with every Item that passes `itemSchema`, live and soft-deleted, now and on each
   * change. An Item document that fails `itemSchema` is skipped and logged, so an empty list means the
   * Catalogue has no valid Items. `onError` is only for a failed read, which ends the watch.
   */
  watchItems(onItems: (items: readonly WatchedItem[]) => void, onError: (error: unknown) => void): Unsubscribe

  /**
   * Sets an Item's State and appends a State history entry stamped with the server time, in one
   * batch; setting the State the Item already has, per the watched Items, writes nothing. The promise
   * resolves once the write is queued, online or offline, without waiting for the server: a refusal
   * is reported to the live watches' `onError`, and the watched Items revert. Rejects if the Item is
   * not among the watched Items.
   */
  setItemState(id: core.ItemId, state: core.State): Promise<void>
}
