import './Switch.css'

export interface SwitchProps {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}

/** A themed M3 switch in a row at least 48dp tall; the whole row, label included, toggles the native checkbox. */
export function Switch({ label, checked, disabled, onChange }: SwitchProps) {
  return (
    <label class="switch">
      <input class="switch__input" type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange} />
      <span class="switch__track" aria-hidden="true">
        <span class="switch__handle" />
      </span>
      {label}
    </label>
  )
}
