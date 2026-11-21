import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { core } from 'data-platform'
import type { ItemsPort, WatchedItem } from './items-port.ts'

const { ITEMS_COLLECTION, itemId, itemSchema, stateHistoryCollectionPath } = core

export function firestoreItemsPort(db: Firestore): ItemsPort {
  return {
    watchItems(onItems, onError) {
      const stop = onSnapshot(
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
          onItems(items)
        },
        onError,
      )
      return stop
    },

    async setItemState(id, state) {
      const itemRef = doc(db, ITEMS_COLLECTION, id)
      await runTransaction(db, async (tx) => {
        const snapshot = await tx.get(itemRef)
        if (!snapshot.exists()) throw new Error(`No Item ${id} to set the State of`)
        if (snapshot.data().state === state) return
        tx.update(itemRef, { state })
        tx.set(doc(collection(db, stateHistoryCollectionPath(id))), { state, at: serverTimestamp() })
      })
    },
  }
}
