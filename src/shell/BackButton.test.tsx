import { fireEvent, render, screen, within } from '@testing-library/preact'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { afterEach, expect, it, vi } from 'vitest'
import { BackButton } from './BackButton.tsx'

afterEach(() => vi.restoreAllMocks())

it('puts a Back button in the top app bar that returns to the previous screen', () => {
  const back = vi.spyOn(history, 'back').mockImplementation(() => {})
  render(
    <TopAppBar title="Somewhere">
      <BackButton />
    </TopAppBar>,
  )
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Back' }))
  expect(back).toHaveBeenCalledOnce()
})
