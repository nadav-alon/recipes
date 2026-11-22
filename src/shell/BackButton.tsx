import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { TopAppBarNavigation } from 'household-ui/shell/TopAppBar.tsx'
import 'household-ui/ui/Dialog.css'
import ArrowBack from '~icons/material-symbols/arrow-back'
import { canGoBack } from '../routes.ts'

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
  const leave = () => (canGoBack() ? history.back() : location.replace(fallback))
  return (
    <TopAppBarNavigation>
      <IconButton symbol={ArrowBack} label="Back" onClick={() => (dirty ? setAsking(true) : leave())} />
      <DiscardDialog open={asking} onDiscard={leave} onCancel={() => setAsking(false)} />
    </TopAppBarNavigation>
  )
}

interface DiscardDialogProps {
  readonly open: boolean
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

/** A modal that asks whether to throw the screen's changes away; closing it any other way than Discard is Cancel. */
function DiscardDialog({ open, onDiscard, onCancel }: DiscardDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      class="ui-dialog"
      aria-label="Discard changes?"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClose={() => open && onCancel()}
    >
      <div class="ui-dialog__header">
        <h2 class="ui-dialog__title">Discard changes?</h2>
      </div>
      <Button variant="text" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="text" destructive onClick={onDiscard}>
        Discard
      </Button>
    </dialog>
  )
}
