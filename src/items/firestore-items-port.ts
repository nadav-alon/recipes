import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { core } from 'data-platform'
import type { ItemsPort, WatchedItem } from './items-port.ts'

const { ITEMS_COLLECTION, itemId, itemSchema, stateHistoryCollectionPath } = core

export function firestoreItemsPort(db: Firestore): ItemsPort {
  /** The State of each Item as the latest watch delivered it, local writes included. */
  const watchedStates = new Map<core.ItemId, core.State>()
  /** The `onError` of every live watch; a refused State write is reported to each. */
  const watchErrors = new Set<(error: unknown) => void>()

  return {
    watchItems(onItems, onError) {
      watchErrors.add(onError)
      const unsubscribe = onSnapshot(
        collection(db, ITEMS_COLLECTION),
        (snapshot) => {
          const items: WatchedItem[] = []
          for (const doc of snapshot.docs) {
            const parsed = itemSchema.safeParse(doc.data())
            if (!parsed.success) {
              const reasons = parsed.error.issues.map((i) => `${i.path.join('.') || 'item'}: ${i.message}`).join('; ')
              console.warn(`Skipping invalid Item ${doc.id}: ${reasons}`)
              continue
            }
            const item = parsed.data
            items.push({ id: itemId(doc.id), name: item.name, state: item.state, deleted: item.deletedAt !== undefined })
          }
          watchedStates.clear()
          for (const item of items) watchedStates.set(item.id, item.state)
          onItems(items)
        },
        onError,
      )
      const stop = () => {
        unsubscribe()
        watchErrors.delete(onError)
        if (watchErrors.size === 0) watchedStates.clear()
      }
      return stop
    },

    async setItemState(id, state) {
      const current = watchedStates.get(id)
      if (current === undefined) throw new Error(`No Item ${id} to set the State of`)
      if (current === state) return
      const batch = writeBatch(db)
      batch.update(doc(db, ITEMS_COLLECTION, id), { state })
      batch.set(doc(collection(db, stateHistoryCollectionPath(id))), { state, at: serverTimestamp() })

      // A batch commit settles only once the server acknowledges it, which offline may be never. The
      // write is queued and already in the watched Items, so the caller does not wait for it; a
      // refusal is reported to the live watches' `onError` instead.
      batch.commit().catch((error: unknown) => watchErrors.forEach((report) => report(error)))
    },
  }
}
