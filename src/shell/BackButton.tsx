import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { TopAppBarNavigation } from 'household-ui/shell/TopAppBar.tsx'
import ArrowBack from '~icons/material-symbols/arrow-back'
import { canGoBack } from '../routes.ts'

/**
 * A back arrow in the enclosing top app bar's leading slot that returns to the screen the user came from;
 * when there is none in the app (a deep link, a shared URL, a fresh launch) it goes to `fallback` instead.
 */
export function BackButton({ fallback }: { fallback: string }) {
  const back = () => (canGoBack() ? history.back() : location.replace(fallback))
  return (
    <TopAppBarNavigation>
      <IconButton symbol={ArrowBack} label="Back" onClick={back} />
    </TopAppBarNavigation>
  )
}
