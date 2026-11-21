import { useEffect } from 'preact/hooks'

const LINGER_MS = 8000

export interface SnackbarProps {
  readonly message: string
  readonly actionLabel: string
  readonly onAction: () => void
  /** Called when the snackbar goes away unused, after eight seconds or on dismissal. */
  readonly onDismiss: () => void
}

/** A transient message with one action, announced politely and dismissed on its own. */
export function Snackbar({ message, actionLabel, onAction, onDismiss }: SnackbarProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, LINGER_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

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
