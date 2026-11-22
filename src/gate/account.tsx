import { createContext } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { TopAppBarActions } from 'household-ui/shell/TopAppBar.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import AccountCircle from '~icons/material-symbols/account-circle'
import { Dialog } from 'household-ui/ui/Dialog.tsx'
import { Button } from 'household-ui/ui/Button.tsx'

/** The signed-in Member, and how they sign out; provided by the AuthGate to everything it lets in. */
export interface SignedInMember {
  email: string
  signOut: () => void
}

export const MemberContext = createContext<SignedInMember | null>(null)

/**
 * The top app bar's account action: opens the signed-in account's email and a Sign out action.
 * Renders nothing outside an AuthGate, where nobody is signed in.
 */
export function AccountAction() {
  const member = useContext(MemberContext)
  const [open, setOpen] = useState(false)
  if (member === null) return null
  return (
    <TopAppBarActions>
      <IconButton symbol={AccountCircle} label="Account" onClick={() => setOpen(true)} />
      <Dialog open={open} title="Account" onClose={() => setOpen(false)} closable>
        <p>{member.email}</p>
        <SignOutButton onClick={member.signOut} />
      </Dialog>
    </TopAppBarActions>
  )
}

export function SignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="tonal" onClick={onClick}>
      Sign out
    </Button>
  )
}
