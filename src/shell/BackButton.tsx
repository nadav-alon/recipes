import { IconButton } from 'household-ui/ui/IconButton.tsx'
import { TopAppBarNavigation } from 'household-ui/shell/TopAppBar.tsx'
import ArrowBack from '~icons/material-symbols/arrow-back'

/** A back arrow in the enclosing top app bar's leading slot that returns to the screen the user came from. */
export function BackButton() {
  return (
    <TopAppBarNavigation>
      <IconButton symbol={ArrowBack} label="Back" onClick={() => history.back()} />
    </TopAppBarNavigation>
  )
}
