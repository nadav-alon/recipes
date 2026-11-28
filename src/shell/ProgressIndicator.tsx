import './ProgressIndicator.css'

export interface ProgressIndicatorProps {
  /** The accessible name: what is being waited for. */
  readonly label: string
}

/** An M3 indeterminate circular progress indicator in the `primary` role. */
export function ProgressIndicator({ label }: ProgressIndicatorProps) {
  return (
    <span class="progress-indicator" role="progressbar" aria-label={label}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle class="progress-indicator__arc" cx="24" cy="24" r="18" />
      </svg>
    </span>
  )
}
