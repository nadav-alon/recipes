import { createContext } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import AccountCircle from '~icons/material-symbols/account-circle'
import { Dialog } from 'household-ui/ui/Dialog.tsx'
import { Button } from 'household-ui/ui/Button.tsx'

/** The signed-in Member, and how they sign out; provided by the AuthGate to everything it lets in. */
export interface Account {
  email: string
  signOut: () => void
}

export const AccountContext = createContext<Account | null>(null)

/**
 * The top app bar's account action: opens the signed-in account's email and a Sign out action.
 * Renders nothing outside an AuthGate, where nobody is signed in.
 */
export function AccountAction() {
  const account = useContext(AccountContext)
  const [open, setOpen] = useState(false)
  if (account === null) return null
  return (
    <TopAppBarActions>
      <IconButton symbol={AccountCircle} label="Account" onClick={() => setOpen(true)} />
      <Dialog open={open} title="Account" onClose={() => setOpen(false)} closable>
        <p>{account.email}</p>
        <Button variant="tonal" onClick={account.signOut}>
          Sign out
        </Button>
      </Dialog>
    </TopAppBarActions>
  )
}
