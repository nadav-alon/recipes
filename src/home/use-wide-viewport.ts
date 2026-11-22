import { useEffect, useState } from 'preact/hooks'

/**
 * The width at which the screen column centres: household-ui's `--shell-content-width` (720px), the
 * `max-width` `src/screens.css` gives `main`. A media query cannot read a custom property, so keep
 * this in step with that token. recipes renders no side rail, so the rail width is not added.
 */
export const WIDE_VIEWPORT_QUERY = '(min-width: 45rem)'

/** Whether the viewport is wide enough for the centred column; false where the browser cannot match media. */
export function useWideViewport(): boolean {
  const [query] = useState(() => (typeof matchMedia === 'function' ? matchMedia(WIDE_VIEWPORT_QUERY) : null))
  const [wide, setWide] = useState(query?.matches ?? false)
  useEffect(() => {
    if (query === null) return
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [query])
  return wide
}
