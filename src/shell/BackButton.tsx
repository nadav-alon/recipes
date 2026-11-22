import { useState } from 'preact/hooks'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { TopAppBarNavigation } from 'household-ui/shell/TopAppBar.tsx'
import ArrowBack from '~icons/material-symbols/arrow-back'
import { canGoBack, dropGuard } from '../routes.ts'
import { DiscardDialog } from './DiscardDialog.tsx'
import { useLeaveGuard } from './useLeaveGuard.ts'

export interface BackButtonProps {
  /** Where Back goes when there is no earlier screen of the app to return to. */
  readonly fallback: string
  /** The screen holds edits that leaving would lose: Back asks to discard them first, and stays put unless confirmed. */
  readonly dirty?: boolean
}

/**
 * A back arrow in the enclosing top app bar's leading slot that returns to the screen the user came from;
 * when there is none in the app (a deep link, a shared URL, a fresh launch) it goes to `fallback` instead.
 */
export function BackButton({ fallback, dirty = false }: BackButtonProps) {
  const [asking, setAsking] = useState(false)
  const leave = () => dropGuard(() => (canGoBack() ? history.back() : location.replace(fallback)))
  // The browser's Back from a dirty screen is caught the same way as the arrow, and asks.
  useLeaveGuard(dirty, () => setAsking(true))
  return (
    <TopAppBarNavigation>
      <IconButton symbol={ArrowBack} label="Back" onClick={() => (dirty ? setAsking(true) : leave())} />
      <DiscardDialog open={asking} onDiscard={leave} onCancel={() => setAsking(false)} />
    </TopAppBarNavigation>
  )
}
