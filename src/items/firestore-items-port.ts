import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { core } from 'data-platform'
import type { ItemsPort, WatchedItem } from './items-port.ts'

const { ITEMS_COLLECTION, itemId, itemSchema, stateHistoryCollectionPath } = core

export function firestoreItemsPort(db: Firestore): ItemsPort {
  return {
    watchItems(onItems, onError) {
      return onSnapshot(
        collection(db, ITEMS_COLLECTION),
        (snapshot) => {
          const items: WatchedItem[] = snapshot.docs.map((doc) => {
            const item = itemSchema.parse(doc.data())
            return { id: itemId(doc.id), name: item.name, state: item.state, deleted: item.deletedAt !== undefined }
          })
          onItems(items)
        },
        onError,
      )
    },

    async setItemState(id, state) {
      const itemRef = doc(db, ITEMS_COLLECTION, id)
      const snapshot = await getDoc(itemRef)
      if (!snapshot.exists()) throw new Error(`No Item ${id} to set the State of`)
      const batch = writeBatch(db)
      batch.update(itemRef, { state })
      batch.set(doc(collection(db, stateHistoryCollectionPath(id))), { state, at: serverTimestamp() })
      await batch.commit()
    },
  }
}
