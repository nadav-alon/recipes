import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { FirebaseWebConfig } from 'data-platform/client'
import { parseConfigText } from './config.ts'
import { Button } from 'household-ui/ui/Button.tsx'
import { CentredCard } from 'household-ui/ui/CentredCard.tsx'
import { TextArea } from 'household-ui/ui/TextArea.tsx'

export type SetupScreenProps = {
  onConfigured: (config: FirebaseWebConfig) => void
  /** An error to show up front, e.g. from a device-transfer link that failed to parse. */
  initialError?: string | null
}

/** Collects the Household's Firebase config when none is stored on this origin. */
export function SetupScreen({ onConfigured, initialError = null }: SetupScreenProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(initialError)

  function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      onConfigured(parseConfigText(text))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Firebase config.')
    }
  }

  return (
    <CentredCard appName="Recipes" title="Set up">
      <p>Paste your Household's Firebase web config, or open a device-transfer link from the Catalogue.</p>
      <form onSubmit={handleSubmit}>
        <TextArea
          label="Firebase web config"
          value={text}
          onInput={(event) => setText(event.currentTarget.value)}
          error={error ?? undefined}
        />
        <Button type="submit" variant="filled">
          Save
        </Button>
      </form>
    </CentredCard>
  )
}
