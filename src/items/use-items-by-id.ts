import { useEffect, useState } from 'preact/hooks'
import type { ItemsById } from '../recipes/makeability.ts'
import type { ItemsPort } from './items-port.ts'

/**
 * The Items at home by id, `null` until they have arrived; `onError` is called if watching them fails.
 * A changed `attempt` drops the Items and watches again, so the caller sees `null` until the new watch delivers.
 */
export function useItemsById(itemsPort: ItemsPort, onError: () => void, attempt: number): ItemsById | null {
  const [items, setItems] = useState<ItemsById | null>(null)
  useEffect(
    () => {
      setItems(null)
      return itemsPort.watchItems(
        (watched) =>
          // An Item the Catalogue has soft-deleted is left out: a link to an absent id counts as soft-deleted.
          setItems(new Map(watched.filter((i) => !i.deleted).map((i) => [i.id, { state: i.state }]))),
        onError,
      )
    },
    [itemsPort, attempt],
  )
  return items
}
