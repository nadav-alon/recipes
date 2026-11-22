import { useLayoutEffect, useRef } from 'preact/hooks'
import { Button } from 'household-ui/ui/Button.tsx'
import 'household-ui/ui/Dialog.css'

interface DiscardDialogProps {
  readonly open: boolean
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

/** A modal that asks whether to throw the screen's changes away; closing it any other way than Discard is Cancel. */
export function DiscardDialog({ open, onDiscard, onCancel }: DiscardDialogProps) {
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
