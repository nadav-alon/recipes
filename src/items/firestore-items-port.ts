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
  const watchedStates = new Map<string, core.State>()
  /** Whether the latest watch snapshot came from the local cache because the server is unreachable. */
  let offline = false

  return {
    watchItems(onItems, onError) {
      let delivered = false
      const stop = onSnapshot(
        collection(db, ITEMS_COLLECTION),
        { includeMetadataChanges: true },
        (snapshot) => {
          offline = snapshot.metadata.fromCache
          if (delivered && snapshot.docChanges().length === 0) return
          let items: WatchedItem[]
          try {
            items = snapshot.docs.map((doc) => {
              const item = itemSchema.parse(doc.data())
              return { id: itemId(doc.id), name: item.name, state: item.state, deleted: item.deletedAt !== undefined }
            })
          } catch (error) {
            stop()
            onError(error)
            return
          }
          delivered = true
          watchedStates.clear()
          for (const item of items) watchedStates.set(item.id, item.state)
          onItems(items)
        },
        onError,
      )
      return stop
    },

    async setItemState(id, state) {
      const current = watchedStates.get(id)
      if (current === undefined) throw new Error(`No Item ${id} to set the State of`)
      if (current === state) return
      const itemRef = doc(db, ITEMS_COLLECTION, id)
      const batch = writeBatch(db)
      batch.update(itemRef, { state })
      batch.set(doc(collection(db, stateHistoryCollectionPath(id))), { state, at: serverTimestamp() })

      // A batch commit settles only once the server acknowledges it, which offline may be never. The
      // write is queued and already in the watched Items, so the caller need not wait for it.
      const committed = batch.commit()
      if (offline) {
        committed.catch(() => {})
        return
      }
      await committed
    },
  }
}
