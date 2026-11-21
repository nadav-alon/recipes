import { useEffect } from 'preact/hooks'

export interface SnackbarProps {
  readonly message: string
  readonly actionLabel: string
  readonly onAction: () => void
  /** Called when the snackbar goes away unused, after `lingerMs` or on dismissal. */
  readonly onDismiss: () => void
  readonly lingerMs?: number
}

/** A transient message with one action, announced politely and dismissed on its own. */
export function Snackbar({ message, actionLabel, onAction, onDismiss, lingerMs = 8000 }: SnackbarProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, lingerMs)
    return () => clearTimeout(timer)
  }, [lingerMs, onDismiss])

  return (
    <div role="status">
      <span>{message}</span>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}
