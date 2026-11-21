import { collection, onSnapshot, type Firestore } from 'firebase/firestore'
import { core } from 'data-platform'

const { ITEMS_COLLECTION, itemId, itemSchema } = core
import type { ItemsPort, WatchedItem } from './items-port.ts'

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
  }
}
