import { fireEvent, render, screen, within } from '@testing-library/preact'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { afterEach, expect, it, vi } from 'vitest'
import { BackButton } from './BackButton.tsx'

afterEach(() => vi.restoreAllMocks())

const clickBack = () => {
  render(
    <TopAppBar title="Somewhere">
      <BackButton fallback="#/fallback" />
    </TopAppBar>,
  )
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Back' }))
}

// Module state: the app has not routed until the first hashchange, so this test must run first.
it('goes to the fallback when the app has not routed, as on a deep link', () => {
  const back = vi.spyOn(history, 'back').mockImplementation(() => {})
  clickBack()
  expect(back).not.toHaveBeenCalled()
  expect(location.hash).toBe('#/fallback')
})

it('returns to the previous screen once the app has routed', () => {
  const back = vi.spyOn(history, 'back').mockImplementation(() => {})
  dispatchEvent(new HashChangeEvent('hashchange'))
  clickBack()
  expect(back).toHaveBeenCalledOnce()
})
