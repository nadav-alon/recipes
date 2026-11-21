import { useEffect, useState } from 'preact/hooks'
import type { ItemsById } from '../recipes/makeability.ts'
import type { ItemsPort } from './items-port.ts'

/** The Items at home by id, `null` until they have arrived; `onError` is called if watching them fails. */
export function useItemsById(itemsPort: ItemsPort, onError: () => void): ItemsById | null {
  const [items, setItems] = useState<ItemsById | null>(null)
  useEffect(
    () =>
      itemsPort.watchItems(
        (watched) =>
          // An Item the Catalogue has soft-deleted is left out: a link to an absent id counts as soft-deleted.
          setItems(new Map(watched.filter((i) => !i.deleted).map((i) => [i.id, { state: i.state }]))),
        onError,
      ),
    [itemsPort],
  )
  return items
}
