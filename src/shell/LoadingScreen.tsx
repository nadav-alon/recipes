import type { ComponentChildren } from 'preact'
import { TopAppBar } from 'household-ui/shell/TopAppBar.tsx'
import { ProgressIndicator } from './ProgressIndicator.tsx'

/** A screen waiting for its data: the app bar with the screen's `title` (and any `children`, such as Back), and the progress indicator. */
export function LoadingScreen({ title, label, children }: { title: string; label: string; children?: ComponentChildren }) {
  return (
    <TopAppBar title={title}>
      {children}
      <main class="screen screen--loading">
        <ProgressIndicator label={label} />
      </main>
    </TopAppBar>
  )
}
