import { useEffect, useState } from 'preact/hooks'

/** The width at which the screen column centres beside the side rail: the column plus the rail. */
export const WIDE_VIEWPORT_QUERY = '(min-width: 51.5rem)'

/** Whether the viewport is wide enough for the centred column; false where the browser cannot match media. */
export function useWideViewport(): boolean {
  const query = typeof matchMedia === 'function' ? matchMedia(WIDE_VIEWPORT_QUERY) : null
  const [wide, setWide] = useState(query?.matches ?? false)
  useEffect(() => {
    if (query === null) return
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}
